import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  STAGE_LABEL,
  type OpportunityStage,
} from "@/lib/crm/types";
import { Target, TrendingUp, Trophy, XCircle, Users, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ from?: string; to?: string }>;
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const pct = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ComercialesPage({ searchParams }: Props) {
  const me = await requireAdmin();
  if (me.role !== "superadmin") {
    redirect("/admin/crm");
  }

  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  const fromISO = sp.from || firstOfMonth();
  const toISO   = sp.to   || today();

  // Cargar workers
  const { data: workers } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "superadmin"])
    .order("full_name");

  // Oportunidades creadas en el rango (por owner)
  const { data: oppsCreated } = await admin
    .from("crm_opportunities")
    .select("id, owner_id, stage, estimated_value, won_at, lost_at, created_at, updated_at")
    .gte("created_at", `${fromISO}T00:00:00`)
    .lte("created_at", `${toISO}T23:59:59`);

  // Oportunidades GANADAS en el rango (won_at dentro)
  const { data: oppsWon } = await admin
    .from("crm_opportunities")
    .select("id, owner_id, estimated_value, won_at")
    .gte("won_at", `${fromISO}T00:00:00`)
    .lte("won_at", `${toISO}T23:59:59`);

  // Oportunidades PERDIDAS en el rango
  const { data: oppsLost } = await admin
    .from("crm_opportunities")
    .select("id, owner_id, lost_at")
    .gte("lost_at", `${fromISO}T00:00:00`)
    .lte("lost_at", `${toISO}T23:59:59`);

  // Contactos creados en el rango
  const { data: contactsCreated } = await admin
    .from("crm_contacts")
    .select("id, owner_id, created_at")
    .gte("created_at", `${fromISO}T00:00:00`)
    .lte("created_at", `${toISO}T23:59:59`);

  // Interacciones creadas en el rango
  const { data: interactionsCreated } = await admin
    .from("crm_interactions")
    .select("id, created_by, created_at")
    .gte("created_at", `${fromISO}T00:00:00`)
    .lte("created_at", `${toISO}T23:59:59`);

  // Oportunidades activas (NO importa rango — son el pipeline actual)
  const { data: oppsActive } = await admin
    .from("crm_opportunities")
    .select("id, owner_id, stage, estimated_value")
    .not("stage", "in", "(won,lost)");

  // ── Calcular métricas por comercial ──────────────────────────────────────
  interface Row {
    workerId: string;
    workerName: string;
    role: string;
    contactsCreated: number;
    interactions: number;
    oppsCreated: number;
    leads: number;
    proposals: number;
    negotiations: number;
    activeCount: number;
    activeValue: number;
    won: number;
    wonValue: number;
    lost: number;
    closedTotal: number;
    winRate: number;
    avgDealSize: number;
  }

  const rows: Row[] = (workers ?? []).map((w) => {
    const created = (oppsCreated ?? []).filter((o) => o.owner_id === w.id);
    const won     = (oppsWon ?? []).filter((o) => o.owner_id === w.id);
    const lost    = (oppsLost ?? []).filter((o) => o.owner_id === w.id);
    const active  = (oppsActive ?? []).filter((o) => o.owner_id === w.id);
    const contacts = (contactsCreated ?? []).filter((c) => c.owner_id === w.id);
    const interactions = (interactionsCreated ?? []).filter((i) => i.created_by === w.id);

    const wonValue = won.reduce((a, o) => a + Number(o.estimated_value ?? 0), 0);
    const activeValue = active.reduce((a, o) => a + Number(o.estimated_value ?? 0), 0);
    const closedTotal = won.length + lost.length;
    const winRate = closedTotal > 0 ? (won.length / closedTotal) * 100 : 0;
    const avgDealSize = won.length > 0 ? wonValue / won.length : 0;

    return {
      workerId: w.id,
      workerName: w.full_name ?? w.id.slice(0, 8),
      role: w.role,
      contactsCreated: contacts.length,
      interactions: interactions.length,
      oppsCreated: created.length,
      leads: created.filter((o) => o.stage === "lead").length,
      proposals: (oppsCreated ?? []).filter((o) => o.owner_id === w.id && ["proposal","negotiation"].includes(o.stage)).length,
      negotiations: created.filter((o) => o.stage === "negotiation").length,
      activeCount: active.length,
      activeValue,
      won: won.length,
      wonValue,
      lost: lost.length,
      closedTotal,
      winRate,
      avgDealSize,
    };
  });

  // Totales agregados
  const totals = rows.reduce((a, r) => ({
    contactsCreated: a.contactsCreated + r.contactsCreated,
    interactions: a.interactions + r.interactions,
    oppsCreated: a.oppsCreated + r.oppsCreated,
    activeValue: a.activeValue + r.activeValue,
    won: a.won + r.won,
    wonValue: a.wonValue + r.wonValue,
    lost: a.lost + r.lost,
  }), { contactsCreated: 0, interactions: 0, oppsCreated: 0, activeValue: 0, won: 0, wonValue: 0, lost: 0 });

  const globalWinRate = (totals.won + totals.lost) > 0
    ? (totals.won / (totals.won + totals.lost)) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Filtro de rango */}
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Desde</label>
          <input type="date" name="from" defaultValue={fromISO} className="h-8 w-44 rounded-md border border-input bg-background px-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Hasta</label>
          <input type="date" name="to" defaultValue={toISO} className="h-8 w-44 rounded-md border border-input bg-background px-2 text-sm" />
        </div>
        <button type="submit" className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90">
          Aplicar
        </button>
      </form>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Oportunidades creadas" value={String(totals.oppsCreated)} icon={<Target className="h-4 w-4" />} />
        <KpiCard label="Ganadas" value={`${totals.won} · ${eur(totals.wonValue)}`} icon={<Trophy className="h-4 w-4" />} color="green" />
        <KpiCard label="Win rate" value={pct(globalWinRate)} icon={<TrendingUp className="h-4 w-4" />} color={globalWinRate >= 50 ? "green" : "default"} />
        <KpiCard label="Valor en pipeline" value={eur(totals.activeValue)} icon={<Target className="h-4 w-4" />} />
      </div>

      {/* Tabla por comercial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">KPIs por comercial</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Comercial</th>
                  <th className="px-3 py-2 text-right font-medium">Contactos</th>
                  <th className="px-3 py-2 text-right font-medium">Interacciones</th>
                  <th className="px-3 py-2 text-right font-medium">Oport. creadas</th>
                  <th className="px-3 py-2 text-right font-medium">Activas</th>
                  <th className="px-3 py-2 text-right font-medium">Pipeline (€)</th>
                  <th className="px-3 py-2 text-right font-medium">Ganadas</th>
                  <th className="px-3 py-2 text-right font-medium">€ ganadas</th>
                  <th className="px-3 py-2 text-right font-medium">Perdidas</th>
                  <th className="px-3 py-2 text-right font-medium">Win rate</th>
                  <th className="px-3 py-2 text-right font-medium">Ticket medio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.workerId} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">
                      {r.workerName}
                      {r.role === "superadmin" && <Badge variant="outline" className="ml-2 text-[9px]">SA</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{r.contactsCreated}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.interactions}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.oppsCreated}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.activeCount}</td>
                    <td className="px-3 py-2 text-right font-mono">{eur(r.activeValue)}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{r.won}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{eur(r.wonValue)}</td>
                    <td className="px-3 py-2 text-right font-mono text-rose-600">{r.lost}</td>
                    <td className={`px-3 py-2 text-right font-mono ${r.winRate >= 50 ? "text-green-700" : ""}`}>
                      {r.closedTotal > 0 ? pct(r.winRate) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{r.won > 0 ? eur(r.avgDealSize) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-primary/5 font-semibold">
                <tr>
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right font-mono">{totals.contactsCreated}</td>
                  <td className="px-3 py-2 text-right font-mono">{totals.interactions}</td>
                  <td className="px-3 py-2 text-right font-mono">{totals.oppsCreated}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right font-mono">{eur(totals.activeValue)}</td>
                  <td className="px-3 py-2 text-right font-mono text-green-700">{totals.won}</td>
                  <td className="px-3 py-2 text-right font-mono text-green-700">{eur(totals.wonValue)}</td>
                  <td className="px-3 py-2 text-right font-mono text-rose-600">{totals.lost}</td>
                  <td className="px-3 py-2 text-right font-mono">{pct(globalWinRate)}</td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
