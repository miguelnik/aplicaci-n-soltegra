import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ALL_STAGES, type OpportunityStage } from "@/lib/crm/types";
import { withAudit } from "../audit";

// ─────────────────────────────────────────────────────────────────────────────
// Tools de LECTURA del CRM.
//
// Cada tool envuelve su lógica en withAudit() para que cada llamada quede
// trazada en agent_audit_log. El bot puede hacer todas las queries que quiera
// sin riesgo — son select-only.
// ─────────────────────────────────────────────────────────────────────────────

const StageEnum = z.enum(ALL_STAGES as [OpportunityStage, ...OpportunityStage[]]);

export function registerCrmReadTools(server: McpServer): void {
  server.registerTool(
    "get_opportunity",
    {
      title: "Detalle de oportunidad",
      description:
        "Devuelve el detalle completo de una oportunidad: datos, contacto, organización, owner y las últimas 20 interacciones (historial de comunicaciones).",
      inputSchema: {
        id: z.string().uuid().describe("UUID de la oportunidad."),
      },
    },
    async ({ id }) => {
      return withAudit("get_opportunity", { id }, async () => {
        const admin = createSupabaseAdminClient();

        const { data: opp, error } = await admin
          .from("crm_opportunities")
          .select(
            `id, title, stage, estimated_value, expected_close_date,
             probability, next_action, next_action_due, notes,
             lost_reason, won_at, lost_at, converted_to_request_id,
             owner_id, contact_id, organization_id, service_type_id,
             created_at, updated_at,
             contact:crm_contacts(full_name, email, phone, company_name),
             organization:organizations(name, cif),
             service:service_types(slug, name)`,
          )
          .eq("id", id)
          .maybeSingle();

        if (error) throw new Error(`DB error: ${error.message}`);
        if (!opp) throw new Error(`Oportunidad ${id} no encontrada.`);

        const { data: interactions } = await admin
          .from("crm_interactions")
          .select("id, kind, direction, subject, summary, happened_at, created_by")
          .eq("opportunity_id", id)
          .order("happened_at", { ascending: false })
          .limit(20);

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { opportunity: opp, interactions: interactions ?? [] },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `Oportunidad "${opp.title}" stage=${opp.stage}`,
        };
      });
    },
  );

  server.registerTool(
    "list_contacts",
    {
      title: "Listar contactos del CRM",
      description:
        "Lista contactos (personas/leads) del CRM. Filtros opcionales por búsqueda libre y owner.",
      inputSchema: {
        search: z.string().max(100).optional().describe(
          "Búsqueda libre en nombre, email, teléfono o empresa.",
        ),
        ownerId: z.string().uuid().optional().describe(
          "Filtrar por owner_id (UUID del usuario propietario).",
        ),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ search, ownerId, limit }) => {
      return withAudit(
        "list_contacts",
        { search, ownerId, limit },
        async () => {
          const admin = createSupabaseAdminClient();
          let query = admin
            .from("crm_contacts")
            .select(
              `id, full_name, email, phone, position, company_name,
               organization_id, owner_id, source, created_at, updated_at,
               organization:organizations(name)`,
            )
            .order("updated_at", { ascending: false })
            .limit(limit);

          if (ownerId) query = query.eq("owner_id", ownerId);
          if (search) {
            // Búsqueda libre OR en varios campos
            query = query.or(
              `full_name.ilike.%${search}%,` +
                `email.ilike.%${search}%,` +
                `phone.ilike.%${search}%,` +
                `company_name.ilike.%${search}%`,
            );
          }

          const { data, error } = await query;
          if (error) throw new Error(`DB error: ${error.message}`);

          return {
            result: {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    { count: data?.length ?? 0, contacts: data ?? [] },
                    null,
                    2,
                  ),
                },
              ],
            },
            summary: `${data?.length ?? 0} contactos`,
          };
        },
      );
    },
  );

  server.registerTool(
    "get_contact",
    {
      title: "Detalle de contacto",
      description:
        "Devuelve un contacto con sus oportunidades vinculadas y las últimas 10 interacciones.",
      inputSchema: {
        id: z.string().uuid().describe("UUID del contacto."),
      },
    },
    async ({ id }) => {
      return withAudit("get_contact", { id }, async () => {
        const admin = createSupabaseAdminClient();

        const { data: contact, error } = await admin
          .from("crm_contacts")
          .select(
            `id, full_name, email, phone, position, company_name,
             organization_id, owner_id, linked_user_id, source, notes,
             created_at, updated_at,
             organization:organizations(name, cif)`,
          )
          .eq("id", id)
          .maybeSingle();

        if (error) throw new Error(`DB error: ${error.message}`);
        if (!contact) throw new Error(`Contacto ${id} no encontrado.`);

        const { data: opportunities } = await admin
          .from("crm_opportunities")
          .select(
            "id, title, stage, estimated_value, expected_close_date, updated_at",
          )
          .eq("contact_id", id)
          .order("updated_at", { ascending: false });

        const { data: interactions } = await admin
          .from("crm_interactions")
          .select("id, kind, direction, subject, summary, happened_at")
          .eq("contact_id", id)
          .order("happened_at", { ascending: false })
          .limit(10);

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    contact,
                    opportunities: opportunities ?? [],
                    interactions: interactions ?? [],
                  },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `Contacto ${contact.full_name} con ${opportunities?.length ?? 0} oportunidades`,
        };
      });
    },
  );

  server.registerTool(
    "list_opportunities",
    {
      title: "Listar oportunidades",
      description:
        "Lista oportunidades del CRM con filtros opcionales. Útil para responder preguntas como '¿qué tengo en oferta?' o '¿cuántas oportunidades tiene Juan abiertas?'. Devuelve las más recientes primero.",
      inputSchema: {
        stage: StageEnum.optional().describe(
          "Filtrar por stage del funnel (contacted, qualified, proposal, won, lost).",
        ),
        ownerId: z.string().uuid().optional().describe(
          "Filtrar por owner_id (UUID del usuario admin propietario).",
        ),
        search: z.string().max(100).optional().describe(
          "Búsqueda libre en el título de la oportunidad.",
        ),
        limit: z.number().int().min(1).max(100).default(20).describe(
          "Máximo de resultados (1–100). Default 20.",
        ),
      },
    },
    async ({ stage, ownerId, search, limit }) => {
      return withAudit(
        "list_opportunities",
        { stage, ownerId, search, limit },
        async () => {
          const admin = createSupabaseAdminClient();
          let query = admin
            .from("crm_opportunities")
            .select(
              `id, title, stage, estimated_value, expected_close_date,
               probability, next_action, next_action_due, contact_id,
               organization_id, owner_id, created_at, updated_at,
               contact:crm_contacts(full_name, email, phone),
               organization:organizations(name)`,
            )
            .order("updated_at", { ascending: false })
            .limit(limit);

          if (stage) query = query.eq("stage", stage);
          if (ownerId) query = query.eq("owner_id", ownerId);
          if (search) query = query.ilike("title", `%${search}%`);

          const { data, error } = await query;
          if (error) throw new Error(`DB error: ${error.message}`);

          const opportunities = (data ?? []).map((o) => ({
            id: o.id,
            title: o.title,
            stage: o.stage,
            estimatedValue: o.estimated_value,
            expectedCloseDate: o.expected_close_date,
            probability: o.probability,
            nextAction: o.next_action,
            nextActionDue: o.next_action_due,
            contact: o.contact
              ? {
                  id: o.contact_id,
                  name: (o.contact as { full_name?: string }).full_name ?? null,
                  email: (o.contact as { email?: string }).email ?? null,
                  phone: (o.contact as { phone?: string }).phone ?? null,
                }
              : null,
            organization: o.organization
              ? {
                  id: o.organization_id,
                  name: (o.organization as { name?: string }).name ?? null,
                }
              : null,
            ownerId: o.owner_id,
            createdAt: o.created_at,
            updatedAt: o.updated_at,
          }));

          return {
            result: {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    { count: opportunities.length, opportunities },
                    null,
                    2,
                  ),
                },
              ],
            },
            summary: `Devueltas ${opportunities.length} oportunidades${stage ? ` (stage=${stage})` : ""}`,
          };
        },
      );
    },
  );
}
