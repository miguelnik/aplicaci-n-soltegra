import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendNuevoMensaje } from "@/lib/email/send";
import { withAudit, logToolCall } from "../audit";
import { AGENT_USER_ID, AGENT_DISPLAY_NAME } from "../constants";

// ─────────────────────────────────────────────────────────────────────────────
// Tools de ESCRITURA con DOBLE PASO sobre proyectos y mensajes al cliente.
//
// Toda tool aquí acepta `confirm: boolean` (default false). En el primer
// paso (confirm=false) devuelve un PREVIEW: qué se haría exactamente, sin
// tocar nada. Solo cuando el agente vuelve a llamarla con confirm=true
// ejecuta de verdad.
//
// El audit log refleja los dos pasos: "dry_run" para el primero y "ok"
// para la ejecución.
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_KEY_RE = /^[a-z0-9_\-]+$/i;

interface PreviewResponse {
  preview: true;
  what: string;
  payload: Record<string, unknown>;
  next: string;
}

function previewResult(
  what: string,
  payload: Record<string, unknown>,
): {
  content: { type: "text"; text: string }[];
} {
  const response: PreviewResponse = {
    preview: true,
    what,
    payload,
    next: "Para ejecutar de verdad, vuelve a llamar a esta tool con confirm=true. Pide confirmación al usuario primero.",
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
  };
}

export function registerProjectWriteTools(server: McpServer): void {
  // ── Convertir oportunidad ganada en proyecto ───────────────────────────────
  server.registerTool(
    "convert_opportunity_to_project",
    {
      title: "Convertir oportunidad → proyecto",
      description:
        "Crea un certificate_request a partir de una oportunidad ganada y marca la oportunidad como won. IRREVERSIBLE: genera un código de referencia, cliente lo verá. Requiere doble paso: primero llama con confirm=false para ver el preview, luego con confirm=true.",
      inputSchema: {
        opportunityId: z.string().uuid(),
        serviceTypeId: z
          .string()
          .uuid()
          .describe(
            "UUID del service_type. Usa list_service_types para ver el catálogo.",
          ),
        propertyAddress: z
          .string()
          .min(3)
          .max(300)
          .describe("Dirección o nombre identificativo del proyecto."),
        confirm: z
          .boolean()
          .default(false)
          .describe(
            "false → solo preview, no ejecuta. true → ejecuta de verdad.",
          ),
      },
    },
    async ({ opportunityId, serviceTypeId, propertyAddress, confirm }) => {
      const args = { opportunityId, serviceTypeId, propertyAddress, confirm };
      const admin = createSupabaseAdminClient();

      // Cargar la oportunidad y service type para componer el preview.
      const { data: opp } = await admin
        .from("crm_opportunities")
        .select("id, title, stage, estimated_value, organization_id, contact_id")
        .eq("id", opportunityId)
        .maybeSingle();
      if (!opp) throw new Error(`Oportunidad ${opportunityId} no encontrada.`);
      if (!opp.organization_id)
        throw new Error(
          "La oportunidad no tiene organization_id. Asigna una organización primero.",
        );

      const { data: svc } = await admin
        .from("service_types")
        .select("id, slug, name, status_phases")
        .eq("id", serviceTypeId)
        .maybeSingle();
      if (!svc) throw new Error(`Service type ${serviceTypeId} no encontrado.`);

      if (!confirm) {
        const start = Date.now();
        void logToolCall({
          toolName: "convert_opportunity_to_project",
          args,
          status: "dry_run",
          summary: `Preview: ${opp.title} → ${svc.name} (${propertyAddress})`,
          durationMs: Date.now() - start,
        });
        return {
          content: previewResult(
            "Convertir oportunidad en proyecto (certificate_request)",
            {
              opportunity: { id: opp.id, title: opp.title, value: opp.estimated_value },
              service: { id: svc.id, name: svc.name },
              propertyAddress,
              effects: [
                "Crea un certificate_request (proyecto) con status=submitted",
                "Asigna form_schema actual del servicio",
                "Marca la oportunidad como 'won' y guarda el converted_to_request_id",
                "Genera un reference_code (SOL-YYYY-####)",
                "Si el contacto no estaba vinculado a la org, lo vincula",
              ],
            },
          ).content,
        };
      }

      return withAudit(
        "convert_opportunity_to_project",
        args,
        async () => {
          // form_schema_id del servicio actual
          const { data: schema } = await admin
            .from("form_schemas")
            .select("id")
            .eq("service_type_id", serviceTypeId)
            .eq("is_current", true)
            .maybeSingle();
          if (!schema)
            throw new Error(
              "El servicio no tiene un form_schema actual configurado.",
            );

          // Reference code
          const { data: refData } = await admin.rpc("next_reference_code");
          const referenceCode =
            typeof refData === "string" ? refData : null;

          const phases =
            (svc.status_phases as Array<{ key: string }> | null) ?? [];

          const now = new Date().toISOString();
          const { data: created, error: createErr } = await admin
            .from("certificate_requests")
            .insert({
              organization_id: opp.organization_id,
              service_type_id: serviceTypeId,
              form_schema_id: schema.id,
              form_data: {},
              status: "submitted",
              status_history: [{ status: "submitted", at: now }],
              reference_code: referenceCode,
              property_address: propertyAddress.trim(),
              price: opp.estimated_value,
              is_hidden_from_client: false,
              current_phase_key: phases.length > 0 ? phases[0].key : null,
              created_by: AGENT_USER_ID,
              is_paid: false,
            })
            .select("id, reference_code")
            .single();

          if (createErr) throw new Error(createErr.message);

          await admin
            .from("crm_opportunities")
            .update({
              stage: "won",
              converted_to_request_id: created.id,
            })
            .eq("id", opportunityId);

          return {
            result: {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      ok: true,
                      project: created,
                      opportunityClosed: opportunityId,
                    },
                    null,
                    2,
                  ),
                },
              ],
            },
            summary: `Proyecto ${created.reference_code ?? created.id} creado desde ${opp.title}`,
          };
        },
      );
    },
  );

  // ── Cambiar fase del proyecto ──────────────────────────────────────────────
  server.registerTool(
    "update_project_phase",
    {
      title: "Cambiar fase del proyecto",
      description:
        "Actualiza el current_phase_key de un proyecto. Las fases son las definidas en service_types.status_phases. Doble paso obligatorio.",
      inputSchema: {
        requestId: z.string().uuid(),
        phaseKey: z
          .string()
          .min(1)
          .max(80)
          .regex(PHASE_KEY_RE)
          .describe("Clave de la fase a aplicar."),
        confirm: z.boolean().default(false),
      },
    },
    async ({ requestId, phaseKey, confirm }) => {
      const args = { requestId, phaseKey, confirm };
      const admin = createSupabaseAdminClient();

      const { data: project } = await admin
        .from("certificate_requests")
        .select(
          "id, reference_code, property_address, current_phase_key, service_type_id",
        )
        .eq("id", requestId)
        .maybeSingle();
      if (!project) throw new Error(`Proyecto ${requestId} no encontrado.`);

      const { data: svc } = await admin
        .from("service_types")
        .select("status_phases")
        .eq("id", project.service_type_id)
        .maybeSingle();
      const validPhases = ((svc?.status_phases as Array<{ key: string }> | null) ??
        []).map((p) => p.key);
      if (validPhases.length > 0 && !validPhases.includes(phaseKey)) {
        throw new Error(
          `Fase "${phaseKey}" no existe en este servicio. Disponibles: ${validPhases.join(", ")}.`,
        );
      }

      if (!confirm) {
        const start = Date.now();
        void logToolCall({
          toolName: "update_project_phase",
          args,
          status: "dry_run",
          summary: `Preview: ${project.reference_code} → fase ${phaseKey}`,
          durationMs: Date.now() - start,
        });
        return {
          content: previewResult("Cambiar fase del proyecto", {
            project: {
              id: project.id,
              ref: project.reference_code,
              currentPhase: project.current_phase_key,
            },
            newPhase: phaseKey,
          }).content,
        };
      }

      return withAudit("update_project_phase", args, async () => {
        const { error } = await admin
          .from("certificate_requests")
          .update({ current_phase_key: phaseKey })
          .eq("id", requestId);
        if (error) throw new Error(error.message);

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { ok: true, requestId, newPhase: phaseKey },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `${project.reference_code ?? requestId} → fase ${phaseKey}`,
        };
      });
    },
  );

  // ── Marcar proyecto como pagado ────────────────────────────────────────────
  server.registerTool(
    "mark_project_paid",
    {
      title: "Marcar proyecto como pagado",
      description:
        "Marca un certificate_request como pagado y registra paid_at=now(). Afecta a facturación. Doble paso obligatorio.",
      inputSchema: {
        requestId: z.string().uuid(),
        confirm: z.boolean().default(false),
      },
    },
    async ({ requestId, confirm }) => {
      const args = { requestId, confirm };
      const admin = createSupabaseAdminClient();
      const { data: project } = await admin
        .from("certificate_requests")
        .select("id, reference_code, property_address, price, is_paid")
        .eq("id", requestId)
        .maybeSingle();
      if (!project) throw new Error(`Proyecto ${requestId} no encontrado.`);
      if (project.is_paid) {
        throw new Error(
          `El proyecto ${project.reference_code ?? requestId} ya está marcado como pagado.`,
        );
      }

      if (!confirm) {
        const start = Date.now();
        void logToolCall({
          toolName: "mark_project_paid",
          args,
          status: "dry_run",
          summary: `Preview: marcar ${project.reference_code} como pagado (${project.price ?? 0}€)`,
          durationMs: Date.now() - start,
        });
        return {
          content: previewResult("Marcar proyecto como pagado", {
            project: {
              id: project.id,
              ref: project.reference_code,
              address: project.property_address,
              price: project.price,
            },
          }).content,
        };
      }

      return withAudit("mark_project_paid", args, async () => {
        const { error } = await admin
          .from("certificate_requests")
          .update({ is_paid: true, paid_at: new Date().toISOString() })
          .eq("id", requestId);
        if (error) throw new Error(error.message);
        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { ok: true, requestId, price: project.price },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `${project.reference_code ?? requestId} marcado pagado (${project.price ?? 0}€)`,
        };
      });
    },
  );

  // ── Enviar mensaje al cliente del proyecto ─────────────────────────────────
  server.registerTool(
    "send_message_to_client",
    {
      title: "Enviar mensaje al cliente del proyecto",
      description:
        "Publica un mensaje en el hilo de comunicación del proyecto. El cliente lo verá en su portal Y recibirá email de aviso. Es visible para el cliente. Doble paso obligatorio.",
      inputSchema: {
        requestId: z.string().uuid(),
        body: z.string().min(1).max(10000),
        confirm: z.boolean().default(false),
      },
    },
    async ({ requestId, body, confirm }) => {
      const args = { requestId, body, confirm };
      const admin = createSupabaseAdminClient();

      const { data: project } = await admin
        .from("certificate_requests")
        .select(
          "id, reference_code, property_address, created_by, organization_id",
        )
        .eq("id", requestId)
        .maybeSingle();
      if (!project) throw new Error(`Proyecto ${requestId} no encontrado.`);

      if (!confirm) {
        const start = Date.now();
        void logToolCall({
          toolName: "send_message_to_client",
          args,
          status: "dry_run",
          summary: `Preview mensaje a ${project.reference_code}: ${body.slice(0, 80)}`,
          durationMs: Date.now() - start,
        });
        return {
          content: previewResult("Enviar mensaje al cliente", {
            project: {
              id: project.id,
              ref: project.reference_code,
            },
            messagePreview: body.length > 500 ? body.slice(0, 500) + "…" : body,
            effects: [
              "Inserta un request_message como autor 'Agente IA' (admin)",
              "Dispara email 'Nuevo mensaje' al cliente propietario",
              "El cliente verá el mensaje en su portal",
            ],
          }).content,
        };
      }

      return withAudit("send_message_to_client", args, async () => {
        const { data: msg, error } = await admin
          .from("request_messages")
          .insert({
            request_id: requestId,
            author_id: AGENT_USER_ID,
            author_role: "admin",
            body: body.trim(),
          })
          .select("id, created_at")
          .single();
        if (error) throw new Error(error.message);

        // Email best-effort
        try {
          const { data: authUser } = await admin.auth.admin.getUserById(
            project.created_by,
          );
          const clientEmail = authUser?.user?.email ?? "";
          await sendNuevoMensaje({
            authorRole: "admin",
            authorName: AGENT_DISPLAY_NAME,
            messageBody: body.trim(),
            referenceCode: project.reference_code ?? requestId,
            propertyAddress: project.property_address ?? "",
            requestId,
            clientEmail,
          });
        } catch (err) {
          console.warn("[mcp/send_message_to_client] email failed", err);
        }

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { ok: true, messageId: msg.id, sentAt: msg.created_at },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `Mensaje enviado a ${project.reference_code ?? requestId}`,
        };
      });
    },
  );
}
