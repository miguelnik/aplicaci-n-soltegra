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
