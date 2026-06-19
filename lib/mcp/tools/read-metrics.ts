import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_STAGES, ALL_STAGES, type OpportunityStage } from "@/lib/crm/types";
import { withAudit } from "../audit";

// ─────────────────────────────────────────────────────────────────────────────
// Tools de MÉTRICAS y DASHBOARD agregadas.
// ─────────────────────────────────────────────────────────────────────────────

export function registerMetricsTools(server: McpServer): void {
  server.registerTool(
    "crm_metrics",
    {
      title: "Métricas del CRM",
      description:
        "KPIs del pipeline de ventas: nº de oportunidades por stage, valor económico total por stage, oportunidades ganadas y perdidas en el periodo, tasa de conversión simple.",
      inputSchema: {
        sinceDays: z
          .number()
          .int()
          .min(1)
          .max(365)
          .default(30)
          .describe("Ventana temporal en días para won/lost (default 30)."),
      },
    },
    async ({ sinceDays }) => {
      return withAudit("crm_metrics", { sinceDays }, async () => {
        const admin = createSupabaseAdminClient();
        const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

        const { data: opps, error } = await admin
          .from("crm_opportunities")
          .select("stage, estimated_value, won_at, lost_at");

        if (error) throw new Error(`DB error: ${error.message}`);

        const byStage: Record<string, { count: number; value: number }> = {};
        for (const stage of ALL_STAGES) {
          byStage[stage] = { count: 0, value: 0 };
        }
        for (const o of opps ?? []) {
          const stage = (o.stage as OpportunityStage) ?? "lead";
          byStage[stage] = byStage[stage] ?? { count: 0, value: 0 };
          byStage[stage].count += 1;
          byStage[stage].value += Number(o.estimated_value ?? 0);
        }

        const wonInPeriod = (opps ?? []).filter(
          (o) => o.won_at && new Date(o.won_at) >= since,
        );
        const lostInPeriod = (opps ?? []).filter(
          (o) => o.lost_at && new Date(o.lost_at) >= since,
        );
        const wonValue = wonInPeriod.reduce(
          (s, o) => s + Number(o.estimated_value ?? 0),
          0,
        );
        const lostValue = lostInPeriod.reduce(
          (s, o) => s + Number(o.estimated_value ?? 0),
          0,
        );

        const decisionsInPeriod = wonInPeriod.length + lostInPeriod.length;
        const winRate =
          decisionsInPeriod === 0
            ? null
            : Math.round((wonInPeriod.length / decisionsInPeriod) * 1000) / 10;

        const activePipelineValue = ACTIVE_STAGES.reduce(
          (s, st) => s + (byStage[st]?.value ?? 0),
          0,
        );
        const activePipelineCount = ACTIVE_STAGES.reduce(
          (s, st) => s + (byStage[st]?.count ?? 0),
          0,
        );

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    periodDays: sinceDays,
                    activePipeline: {
                      count: activePipelineCount,
                      value: activePipelineValue,
                    },
                    byStage,
                    period: {
                      won: { count: wonInPeriod.length, value: wonValue },
                      lost: { count: lostInPeriod.length, value: lostValue },
                      winRatePct: winRate,
                    },
                  },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `Pipeline activo: ${activePipelineCount} opps (${activePipelineValue}€)`,
        };
      });
    },
  );

  server.registerTool(
    "company_dashboard",
    {
      title: "Dashboard de empresa",
      description:
        "Snapshot operativo de Soltegra: proyectos en curso por status, facturación del mes, horas imputadas del mes, tareas pendientes y vencidas.",
      inputSchema: {},
    },
    async () => {
      return withAudit("company_dashboard", {}, async () => {
        const admin = createSupabaseAdminClient();
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .slice(0, 10);

        // Proyectos por status (excluyendo overhead)
        const { data: projects } = await admin
          .from("certificate_requests")
          .select("status, price, is_paid, paid_at")
          .eq("is_general_overhead", false);

        const byStatus: Record<string, number> = {};
        for (const p of projects ?? []) {
          byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
        }

        // Facturación del mes actual (paid_at en este mes)
        const billedThisMonth = (projects ?? [])
          .filter(
            (p) =>
              p.is_paid &&
              p.paid_at &&
              p.paid_at >= startOfMonth + "T00:00:00Z",
          )
          .reduce((s, p) => s + Number(p.price ?? 0), 0);

        const pendingBilling = (projects ?? [])
          .filter((p) => !p.is_paid && p.price != null)
          .reduce((s, p) => s + Number(p.price ?? 0), 0);

        // Horas del mes
        const { data: hours } = await admin
          .from("time_entries")
          .select("hours, entry_date")
          .gte("entry_date", startOfMonth);
        const hoursThisMonth = (hours ?? []).reduce(
          (s, h) => s + Number(h.hours),
          0,
        );

        // Tareas pendientes y vencidas
        const { data: tasks } = await admin
          .from("user_tasks")
          .select("id, due_at")
          .eq("status", "pending");
        const overdue = (tasks ?? []).filter(
          (t) => t.due_at && new Date(t.due_at) < now,
        ).length;

        // Próximos vencimientos (deadline cliente en próximos 7 días)
        const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        const today = now.toISOString().slice(0, 10);
        const { data: upcoming } = await admin
          .from("certificate_requests")
          .select("id, reference_code, property_address, client_deadline, status")
          .gte("client_deadline", today)
          .lte("client_deadline", in7)
          .neq("status", "delivered")
          .neq("status", "cancelled")
          .order("client_deadline", { ascending: true });

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    projectsByStatus: byStatus,
                    finance: {
                      billedThisMonth,
                      pendingBilling,
                      monthStart: startOfMonth,
                    },
                    hoursThisMonth,
                    tasks: {
                      pendingTotal: tasks?.length ?? 0,
                      overdue,
                    },
                    upcomingDeadlines: upcoming ?? [],
                  },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `${byStatus.in_progress ?? 0} proyectos en curso, ${billedThisMonth}€ facturados este mes`,
        };
      });
    },
  );
}
