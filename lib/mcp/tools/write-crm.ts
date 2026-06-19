import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ALL_STAGES, type OpportunityStage } from "@/lib/crm/types";
import { withAudit } from "../audit";
import { AGENT_USER_ID } from "../constants";

// ─────────────────────────────────────────────────────────────────────────────
// Tools de ESCRITURA del CRM.
//
// Las que NO son irreversibles (cambiar stage, añadir notas, crear contacto…)
// se ejecutan directamente. Las irreversibles (mark_lost convertido en
// negocio, conversiones a proyecto…) viven en write-projects.ts con dryRun.
//
// Todas las mutaciones marcan al Agente IA como owner/creador/autor para
// trazabilidad.
// ─────────────────────────────────────────────────────────────────────────────

const StageEnum = z.enum(ALL_STAGES as [OpportunityStage, ...OpportunityStage[]]);
const InteractionKindEnum = z.enum([
  "email",
  "call",
  "meeting",
  "note",
  "whatsapp",
  "other",
]);
const InteractionDirectionEnum = z.enum(["inbound", "outbound"]);

export function registerCrmWriteTools(server: McpServer): void {
  // ── Cambiar el stage de una oportunidad ────────────────────────────────────
  server.registerTool(
    "update_opportunity_stage",
    {
      title: "Cambiar stage de oportunidad",
      description:
        "Mueve una oportunidad de columna en el kanban del CRM. Para marcarla como perdida usa mark_opportunity_lost (te pide razón).",
      inputSchema: {
        id: z.string().uuid(),
        stage: StageEnum.describe(
          "Nuevo stage: contacted, qualified, proposal, won, lost.",
        ),
        reason: z.string().max(500).optional().describe(
          "Motivo del cambio (opcional, se añade a notas internas).",
        ),
      },
    },
    async ({ id, stage, reason }) => {
      return withAudit(
        "update_opportunity_stage",
        { id, stage, reason },
        async () => {
          const admin = createSupabaseAdminClient();

          // Si pasa a lost, exigir reason (no lo dejamos vacío).
          if (stage === "lost" && !reason?.trim()) {
            throw new Error(
              "Para marcar como perdida usa mark_opportunity_lost con un motivo.",
            );
          }

          const update: Record<string, unknown> = { stage };
          if (reason?.trim()) update.lost_reason = reason.trim();

          const { data, error } = await admin
            .from("crm_opportunities")
            .update(update)
            .eq("id", id)
            .select("id, title, stage")
            .single();

          if (error) throw new Error(`DB error: ${error.message}`);
          if (!data) throw new Error(`Oportunidad ${id} no encontrada.`);

          // Anotamos como interacción tipo "note" del agente para trazabilidad.
          await admin.from("crm_interactions").insert({
            opportunity_id: id,
            kind: "note",
            direction: "outbound",
            subject: `Stage → ${stage}`,
            summary: reason?.trim() || `Movida a ${stage} por el agente.`,
            created_by: AGENT_USER_ID,
          });

          return {
            result: {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({ ok: true, opportunity: data }, null, 2),
                },
              ],
            },
            summary: `Oportunidad ${data.title} → ${stage}`,
          };
        },
      );
    },
  );

  // ── Marcar oportunidad como perdida (con razón) ────────────────────────────
  server.registerTool(
    "mark_opportunity_lost",
    {
      title: "Marcar oportunidad como perdida",
      description:
        "Marca una oportunidad como perdida (lost) y guarda la razón. La razón es obligatoria para no perder la trazabilidad.",
      inputSchema: {
        id: z.string().uuid(),
        reason: z
          .string()
          .min(3)
          .max(500)
          .describe("Motivo por el que se perdió (obligatorio)."),
      },
    },
    async ({ id, reason }) => {
      return withAudit("mark_opportunity_lost", { id, reason }, async () => {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin
          .from("crm_opportunities")
          .update({ stage: "lost", lost_reason: reason.trim() })
          .eq("id", id)
          .select("id, title")
          .single();
        if (error) throw new Error(`DB error: ${error.message}`);
        if (!data) throw new Error(`Oportunidad ${id} no encontrada.`);

        await admin.from("crm_interactions").insert({
          opportunity_id: id,
          kind: "note",
          direction: "outbound",
          subject: "Perdida",
          summary: reason.trim(),
          created_by: AGENT_USER_ID,
        });

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ ok: true, opportunity: data }, null, 2),
              },
            ],
          },
          summary: `Oportunidad ${data.title} perdida`,
        };
      });
    },
  );

  // ── Actualizar oportunidad (campos genéricos) ──────────────────────────────
  server.registerTool(
    "update_opportunity",
    {
      title: "Actualizar oportunidad",
      description:
        "Actualiza campos de una oportunidad: owner, próxima acción, valor estimado, fecha de cierre estimada, probabilidad, notas, etc. Solo se modifican los campos que pases.",
      inputSchema: {
        id: z.string().uuid(),
        ownerId: z.string().uuid().nullish(),
        nextAction: z.string().max(300).nullish(),
        nextActionDue: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish()
          .describe("Fecha YYYY-MM-DD."),
        estimatedValue: z.number().nullish().describe("En euros."),
        expectedCloseDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish(),
        probability: z.number().int().min(0).max(100).nullish(),
        notes: z.string().max(5000).nullish(),
        title: z.string().min(1).max(300).optional(),
      },
    },
    async (input) => {
      return withAudit("update_opportunity", input, async () => {
        const admin = createSupabaseAdminClient();

        const update: Record<string, unknown> = {};
        if (input.ownerId !== undefined) update.owner_id = input.ownerId;
        if (input.nextAction !== undefined)
          update.next_action = input.nextAction?.trim() || null;
        if (input.nextActionDue !== undefined)
          update.next_action_due = input.nextActionDue;
        if (input.estimatedValue !== undefined)
          update.estimated_value = input.estimatedValue;
        if (input.expectedCloseDate !== undefined)
          update.expected_close_date = input.expectedCloseDate;
        if (input.probability !== undefined) update.probability = input.probability;
        if (input.notes !== undefined) update.notes = input.notes?.trim() || null;
        if (input.title !== undefined) update.title = input.title.trim();

        if (Object.keys(update).length === 0) {
          throw new Error("Pasa al menos un campo para actualizar.");
        }

        const { data, error } = await admin
          .from("crm_opportunities")
          .update(update)
          .eq("id", input.id)
          .select("id, title, stage, estimated_value, next_action, next_action_due")
          .single();
        if (error) throw new Error(`DB error: ${error.message}`);
        if (!data) throw new Error(`Oportunidad ${input.id} no encontrada.`);

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ ok: true, opportunity: data }, null, 2),
              },
            ],
          },
          summary: `Actualizada ${data.title}`,
        };
      });
    },
  );

  // ── Añadir interacción al historial ────────────────────────────────────────
  server.registerTool(
    "add_interaction",
    {
      title: "Registrar interacción / nota",
      description:
        "Añade una entrada al historial de comunicaciones de una oportunidad o un contacto. Útil para registrar llamadas, emails, notas internas o conversaciones de WhatsApp.",
      inputSchema: {
        opportunityId: z.string().uuid().optional(),
        contactId: z.string().uuid().optional(),
        kind: InteractionKindEnum,
        direction: InteractionDirectionEnum.optional(),
        subject: z.string().max(300).optional(),
        summary: z.string().min(1).max(5000),
        happenedAt: z
          .string()
          .datetime()
          .optional()
          .describe("ISO datetime. Por defecto ahora."),
      },
    },
    async (input) => {
      return withAudit("add_interaction", input, async () => {
        if (!input.opportunityId && !input.contactId) {
          throw new Error(
            "Debes asociar la interacción a una oportunidad o a un contacto.",
          );
        }
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin
          .from("crm_interactions")
          .insert({
            opportunity_id: input.opportunityId ?? null,
            contact_id: input.contactId ?? null,
            kind: input.kind,
            direction: input.direction ?? null,
            subject: input.subject?.trim() || null,
            summary: input.summary.trim(),
            happened_at: input.happenedAt ?? new Date().toISOString(),
            created_by: AGENT_USER_ID,
          })
          .select("id, happened_at")
          .single();
        if (error) throw new Error(`DB error: ${error.message}`);
        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ ok: true, interaction: data }, null, 2),
              },
            ],
          },
          summary: `Interacción ${input.kind} registrada`,
        };
      });
    },
  );

  // ── Crear contacto ─────────────────────────────────────────────────────────
  server.registerTool(
    "create_contact",
    {
      title: "Crear contacto",
      description:
        "Crea un nuevo contacto (persona) en el CRM. Si el email ya existe en otro contacto, NO duplica — devuelve el existente.",
      inputSchema: {
        fullName: z.string().min(1).max(200),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
        position: z.string().max(100).optional(),
        companyName: z.string().max(200).optional(),
        organizationId: z.string().uuid().optional(),
        ownerId: z.string().uuid().optional(),
        notes: z.string().max(2000).optional(),
      },
    },
    async (input) => {
      return withAudit("create_contact", input, async () => {
        const admin = createSupabaseAdminClient();

        // Dedupe por email si lo trae.
        if (input.email) {
          const { data: existing } = await admin
            .from("crm_contacts")
            .select("id, full_name, email")
            .ilike("email", input.email.trim().toLowerCase())
            .maybeSingle();
          if (existing) {
            return {
              result: {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      { ok: true, contact: existing, deduped: true },
                      null,
                      2,
                    ),
                  },
                ],
              },
              summary: `Contacto existente reutilizado (${existing.full_name})`,
            };
          }
        }

        const { data, error } = await admin
          .from("crm_contacts")
          .insert({
            full_name: input.fullName.trim(),
            email: input.email?.trim().toLowerCase() ?? null,
            phone: input.phone?.trim() ?? null,
            position: input.position?.trim() ?? null,
            company_name: input.companyName?.trim() ?? null,
            organization_id: input.organizationId ?? null,
            owner_id: input.ownerId ?? AGENT_USER_ID,
            notes: input.notes?.trim() ?? null,
            source: "agent",
          })
          .select("id, full_name, email")
          .single();
        if (error) throw new Error(`DB error: ${error.message}`);

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ ok: true, contact: data }, null, 2),
              },
            ],
          },
          summary: `Contacto creado: ${data.full_name}`,
        };
      });
    },
  );

  // ── Crear oportunidad ──────────────────────────────────────────────────────
  server.registerTool(
    "create_opportunity",
    {
      title: "Crear oportunidad",
      description:
        "Crea una nueva oportunidad en el CRM en stage 'contacted' por defecto.",
      inputSchema: {
        title: z.string().min(1).max(300),
        contactId: z.string().uuid().optional(),
        organizationId: z.string().uuid().optional(),
        ownerId: z.string().uuid().optional(),
        stage: StageEnum.default("contacted"),
        serviceTypeId: z.string().uuid().optional(),
        estimatedValue: z.number().optional(),
        expectedCloseDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        notes: z.string().max(5000).optional(),
      },
    },
    async (input) => {
      return withAudit("create_opportunity", input, async () => {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin
          .from("crm_opportunities")
          .insert({
            title: input.title.trim(),
            contact_id: input.contactId ?? null,
            organization_id: input.organizationId ?? null,
            owner_id: input.ownerId ?? AGENT_USER_ID,
            stage: input.stage,
            service_type_id: input.serviceTypeId ?? null,
            estimated_value: input.estimatedValue ?? null,
            expected_close_date: input.expectedCloseDate ?? null,
            notes: input.notes?.trim() ?? null,
            created_by: AGENT_USER_ID,
            source: "agent",
          })
          .select("id, title, stage")
          .single();
        if (error) throw new Error(`DB error: ${error.message}`);
        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ ok: true, opportunity: data }, null, 2),
              },
            ],
          },
          summary: `Oportunidad creada: ${data.title}`,
        };
      });
    },
  );
}
