import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computePnl,
  filterByDateRange,
  monthBounds,
  monthLabel,
  currentMonth,
} from "@/lib/finance/pnl";
import type { FinanceEntry } from "@/lib/finance/types";

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});
const pct = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;

interface Props {
  searchParams: Promise<{ month?: string; range?: string }>;
}

/** Genera lista de últimos 12 meses como YYYY-MM */
function lastTwelveMonths(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.unshift(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export default async function PnlPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  const months = lastTwelveMonths();
  const selectedMonth = sp.month && months.includes(sp.month) ? sp.month : currentMonth();
  const range = sp.range === "year" ? "year" : "month";

  // Determinar rango
  let fromISO: string;
  let toISO: string;
  if (range === "year") {
    // Año natural del mes seleccionado
    const [y] = selectedMonth.split("-").map(Number);
    fromISO = `${y}-01-01`;
    toISO   = `${y}-12-31`;
  } else {
    const b = monthBounds(selectedMonth);
    fromISO = b.from;
    toISO   = b.to;
  }

  // Cargar entries del rango
  const { data: rows } = await admin
    .from("finance_entries")
    .select("*")
    .gte("entry_date", fromISO)
    .lte("entry_date", toISO)
    .order("entry_date");

  const entries = (rows ?? []) as FinanceEntry[];
  const pnl = computePnl(entries);

  // Para el resumen anual mes a mes, cargar 12 meses
  const { data: yearRows } = await admin
    .from("finance_entries")
    .select("*")
    .gte("entry_date", `${new Date().getFullYear() - 1}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`)
    .lte("entry_date", toISO);

  const yearEntries = (yearRows ?? []) as FinanceEntry[];

  // Calcular P&L por mes
  const monthlyPnls = months.map((m) => {
    const b = monthBounds(m);
    const monthEntries = filterByDateRange(yearEntries, b.from, b.to);
    return { month: m, pnl: computePnl(monthEntries) };
  });

  return (
    <div className="space-y-6">
      {/* ── Selector de periodo ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4">
          <form className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Mes</label>
              <select
                name="month"
                defaultValue={selectedMonth}
                className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Rango</label>
              <select
                name="range"
                defaultValue={range}
                className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="month">Mes seleccionado</option>
                <option value="year">Año completo</option>
              </select>
            </div>
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Aplicar
            </button>
          </form>
        </CardContent>
      </Card>

      {/* ── Tabla P&L del periodo seleccionado ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            P&L — {range === "year" ? `Año ${selectedMonth.slice(0, 4)}` : monthLabel(selectedMonth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {pnl.rows.map((r, i) => {
                  const isMargin    = r.type === "margin" || r.type === "margin_pct" || r.type === "total";
                  const isSubtotal  = r.type === "subtotal";
                  const isHeader    = (r.label === "INGRESOS" || r.label === "COSTES VARIABLES" || r.label === "COSTES FIJOS");
                  const isNegative  = isMargin && r.amount < 0;
                  return (
                    <tr
                      key={i}
                      className={
                        isHeader   ? "bg-muted/50" :
                        isMargin   ? "bg-primary/5" :
                        isSubtotal ? "bg-muted/20" : ""
                      }
                    >
                      <td className={`px-3 py-2 ${r.bold ? "font-semibold" : ""} ${(r.indent ?? 0) > 0 ? "pl-8 text-muted-foreground" : ""}`}>
                        {r.label}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${r.bold ? "font-semibold" : ""} ${isNegative ? "text-red-600" : isMargin ? "text-foreground" : ""}`}>
                        {r.type === "margin_pct" ? pct(r.amount) : eur(r.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabla mensual últimos 12 meses ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolución últimos 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Mes</th>
                  <th className="px-3 py-2 text-right font-medium">Ingresos</th>
                  <th className="px-3 py-2 text-right font-medium">CV</th>
                  <th className="px-3 py-2 text-right font-medium">M. bruto</th>
                  <th className="px-3 py-2 text-right font-medium">M. bruto %</th>
                  <th className="px-3 py-2 text-right font-medium">Opex</th>
                  <th className="px-3 py-2 text-right font-medium">M. neto</th>
                  <th className="px-3 py-2 text-right font-medium">M. neto %</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {monthlyPnls.map(({ month, pnl: p }) => (
                  <tr key={month} className="hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap">{monthLabel(month)}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{eur(p.totals.totalIncome)}</td>
                    <td className="px-3 py-2 text-right font-mono text-orange-600">{eur(p.totals.totalVariableCost)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${p.totals.grossMargin < 0 ? "text-red-600" : ""}`}>
                      {eur(p.totals.grossMargin)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${p.totals.grossMargin < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      {pct(p.totals.grossMarginPct)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-orange-600">{eur(p.totals.totalOpex)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${p.totals.netMargin < 0 ? "text-red-600" : ""}`}>
                      {eur(p.totals.netMargin)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${p.totals.netMargin < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      {pct(p.totals.netMarginPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
