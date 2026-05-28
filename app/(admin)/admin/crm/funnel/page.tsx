import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Trophy, AlertCircle, Users } from "lucide-react";
import {
  computeFunnel, FUNNEL_STAGES,
  type OpportunityForFunnel,
  type FunnelResult,
} from "@/lib/crm/funnel";
import type { OpportunityStage } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ owner?: string; from?: string; to?: string }>;
}

const pct = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;

export default async function FunnelPage({ searchParams }: Props) {
  const me = await requireAdmin();
  const isSuper = me.role === "superadmin";
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  // Comerciales para el filtro
  const { data: workers } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "superadmin"])
    .order("full_name");

  // Filtro por rango de fechas (sobre created_at de la oportunidad)
  const fromISO = sp.from || null;
  const toISO = sp.to || null;

  // Si no es superadmin, fuerza filtro a "yo"
  const ownerFilter = isSuper ? (sp.owner || "") : me.id;

  // Cargar oportunidades + su historial
  let oppQuery = admin
    .from("crm_opportunities")
    .select(`
      id, owner_id, stage,
      crm_opportunity_stage_history ( to_stage )
    `);

  if (ownerFilter) oppQuery = oppQuery.eq("owner_id", ownerFilter);
  if (fromISO) oppQuery = oppQuery.gte("created_at", `${fromISO}T00:00:00`);
  if (toISO) oppQuery = oppQuery.lte("created_at", `${toISO}T23:59:59`);

  const { data: oppRows } = await oppQuery;

  const opps: OpportunityForFunnel[] = (oppRows ?? []).map((o) => {
    const history = (o.crm_opportunity_stage_history ?? []) as { to_stage: OpportunityStage }[];
    return {
      id: o.id,
      owner_id: o.owner_id,
      current_stage: o.stage,
      history_stages: history.map((h) => h.to_stage),
    };
  });

  const globalFunnel = computeFunnel(opps);

  // Por comercial (sólo si superadmin)
  const perCommercial: { worker: { id: string; full_name: string | null; role: string }; funnel: FunnelResult }[] = [];
  if (isSuper) {
    for (const w of workers ?? []) {
      const myOpps = opps.filter((o) => o.owner_id === w.id);
      if (myOpps.length === 0) continue;
      perCommercial.push({ worker: w, funnel: computeFunnel(myOpps) });
    }
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        {isSuper && (
          <div className="space-y-1">
            <label className="text-xs font-medium">Comercial</label>
            <select
              name="owner"
              defaultValue={ownerFilter}
              className="h-8 w-56 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Todos (global)</option>
              {(workers ?? []).map((w) => (
                <option key={w.id} value={w.id}>{w.full_name ?? w.id.slice(0,8)}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium">Desde</label>
          <input
            type="date" name="from" defaultValue={fromISO ?? ""}
            className="h-8 w-44 rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Hasta</label>
          <input
            type="date" name="to" defaultValue={toISO ?? ""}
            className="h-8 w-44 rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Aplicar
        </button>
        <a href="/admin/crm/funnel" className="text-xs text-muted-foreground hover:text-foreground">
          Limpiar
        </a>
      </form>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Oportunidades" value={String(globalFunnel.totalEntered)} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Activas" value={String(globalFunnel.totalActive)} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Ganadas" value={String(globalFunnel.totalWon)} icon={<Trophy className="h-4 w-4" />} color="green" />
        <KpiCard label="Win rate" value={pct(globalFunnel.overallWinRate)} icon={<TrendingDown className="h-4 w-4" />} color={globalFunnel.overallWinRate >= 50 ? "green" : "default"} />
      </div>

      {/* Funnel global / del comercial seleccionado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {ownerFilter
              ? `Funnel de ${(workers ?? []).find((w) => w.id === ownerFilter)?.full_name ?? "comercial"}`
              : "Funnel global de la empresa"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FunnelTable funnel={globalFunnel} />
          <FunnelVisual funnel={globalFunnel} />
        </CardContent>
      </Card>

      {/* Por comercial (sólo superadmin y si no hay filtro de owner activo) */}
      {isSuper && !ownerFilter && perCommercial.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funnel por comercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {perCommercial.map(({ worker, funnel }) => (
              <div key={worker.id}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-medium">{worker.full_name ?? worker.id.slice(0,8)}</h3>
                  {worker.role === "superadmin" && <Badge variant="outline" className="text-[9px]">SA</Badge>}
                  <span className="text-xs text-muted-foreground">
                    · {funnel.totalEntered} oportunidades · {funnel.totalWon} ganadas · {pct(funnel.overallWinRate)} win rate
                  </span>
                </div>
                <FunnelTable funnel={funnel} compact />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {globalFunnel.totalEntered === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin oportunidades con los filtros indicados.
        </p>
      )}
    </div>
  );
}

// ── Componentes auxiliares ──────────────────────────────────────────────────

function KpiCard({ label, value, icon, color = "default" }: { label: string; value: string; icon: React.ReactNode; color?: "default" | "green" | "rose" }) {
  const colorClass =
    color === "green" ? "text-green-700" :
    color === "rose"  ? "text-rose-600" :
                        "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`font-mono text-xl font-bold ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FunnelTable({ funnel, compact = false }: { funnel: FunnelResult; compact?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Etapa</th>
            <th className="px-3 py-2 text-right font-medium">Entraron</th>
            <th className="px-3 py-2 text-right font-medium">Avanzaron</th>
            <th className="px-3 py-2 text-right font-medium">% avance</th>
            <th className="px-3 py-2 text-right font-medium">Perdidas</th>
            <th className="px-3 py-2 text-right font-medium">Pendientes</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {funnel.stages.map((s, idx) => {
            const next = FUNNEL_STAGES[idx + 1];
            const nextLabel = next ? next.label : "Ganada";
            return (
              <tr key={s.key} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <p className="font-medium">{s.label}</p>
                  {!compact && (
                    <p className="text-[10px] text-muted-foreground">→ {nextLabel}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">{s.entered}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{s.advanced}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${s.conversionPct >= 50 ? "text-green-700" : s.conversionPct < 25 ? "text-rose-600" : "text-amber-600"}`}>
                  {pct(s.conversionPct)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-rose-600">{s.lost}</td>
                <td className="px-3 py-2 text-right font-mono text-amber-600">{s.stuck}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FunnelVisual({ funnel }: { funnel: FunnelResult }) {
  if (funnel.totalEntered === 0) return null;
  const maxEntered = Math.max(...funnel.stages.map((s) => s.entered), funnel.totalWon);
  if (maxEntered === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Visualización
      </p>
      {funnel.stages.map((s) => {
        const widthPct = (s.entered / maxEntered) * 100;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-xs font-medium">{s.label}</div>
            <div className="relative h-7 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="absolute inset-y-0 left-0 flex items-center justify-end bg-primary px-2 text-xs font-semibold text-primary-foreground"
                style={{ width: `${Math.max(widthPct, 2)}%` }}
              >
                {s.entered}
              </div>
            </div>
            <div className="w-20 shrink-0 text-right text-xs text-muted-foreground">
              {pct(s.conversionPct)} avance
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        <div className="w-24 shrink-0 text-xs font-medium">Ganadas</div>
        <div className="relative h-7 flex-1 overflow-hidden rounded bg-muted">
          <div
            className="absolute inset-y-0 left-0 flex items-center justify-end bg-green-600 px-2 text-xs font-semibold text-white"
            style={{ width: `${Math.max((funnel.totalWon / maxEntered) * 100, 2)}%` }}
          >
            {funnel.totalWon}
          </div>
        </div>
        <div className="w-20 shrink-0 text-right text-xs text-muted-foreground">
          {pct(funnel.overallWinRate)} win
        </div>
      </div>
      {funnel.totalLost > 0 && (
        <div className="flex items-center gap-3">
          <div className="w-24 shrink-0 text-xs font-medium">Perdidas</div>
          <div className="relative h-7 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="absolute inset-y-0 left-0 flex items-center justify-end bg-rose-500 px-2 text-xs font-semibold text-white"
              style={{ width: `${Math.max((funnel.totalLost / maxEntered) * 100, 2)}%` }}
            >
              <AlertCircle className="mr-1 h-3 w-3" />
              {funnel.totalLost}
            </div>
          </div>
          <div className="w-20 shrink-0 text-right text-xs text-muted-foreground">
            del total
          </div>
        </div>
      )}
    </div>
  );
}
