import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computePnl,
  filterByDateRange,
  monthBounds,
  monthLabel,
  monthShortLabel,
  currentMonth,
  platformMonths,
  platformYears,
  monthsOfYear,
  PLATFORM_START_YEAR,
} from "@/lib/finance/pnl";
import type { FinanceEntry } from "@/lib/finance/types";
import type { TimeEntry } from "@/lib/hours/types";

export const dynamic = "force-dynamic";

function normalizeTime(rows: Array<{ hours: string | number; hourly_cost_snapshot: string | number | null } & Record<string, unknown>>): TimeEntry[] {
  return rows.map((t) => ({
    ...(t as unknown as TimeEntry),
    hours: Number(t.hours),
    hourly_cost_snapshot: t.hourly_cost_snapshot != null ? Number(t.hourly_cost_snapshot) : null,
  }));
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});
const pct = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;

interface Props {
  searchParams: Promise<{ month?: string; year?: string; range?: string }>;
}

export default async function PnlPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  const months = platformMonths();
  const years  = platformYears();
  const range  = sp.range === "year" ? "year" : "month";

  const selectedMonth = sp.month && months.includes(sp.month)
    ? sp.month
    : currentMonth();
  const selectedYear = sp.year && years.includes(Number(sp.year))
    ? Number(sp.year)
    : new Date().getFullYear();

  // ── Rango de fechas a consultar ────────────────────────────────────────
  let fromISO: string;
  let toISO: string;
  let yearMonths: string[] = [];
  if (range === "year") {
    yearMonths = monthsOfYear(selectedYear);
    const first = monthBounds(yearMonths[0]).from;
    const last  = monthBounds(yearMonths[yearMonths.length - 1]).to;
    fromISO = first;
    toISO   = last;
  } else {
    const b = monthBounds(selectedMonth);
    fromISO = b.from;
    toISO   = b.to;
  }

  // ── Cargar entries del rango ───────────────────────────────────────────
  const { data: rows, error: queryError } = await admin
    .from("finance_entries")
    .select("*")
    .gte("entry_date", fromISO)
    .lte("entry_date", toISO)
    .order("entry_date");

  if (queryError) {
    throw new Error(`Error consultando finance_entries: ${queryError.message}`);
  }

  const entries = (rows ?? []) as FinanceEntry[];

  // Horas en el rango (para alimentar la línea "Sueldos")
  const { data: timeRows } = await admin
    .from("time_entries")
    .select("*")
    .gte("entry_date", fromISO)
    .lte("entry_date", toISO);
  const timeEntries = normalizeTime((timeRows ?? []) as Array<{ hours: string | number; hourly_cost_snapshot: string | number | null } & Record<string, unknown>>);

  const pnl = computePnl(entries, timeEntries);

  // Para el desglose mes-a-mes del año seleccionado, agrupamos por mes
  const monthlyForYear = range === "year"
    ? yearMonths.map((m) => {
        const b = monthBounds(m);
        const monthEntries = filterByDateRange(entries, b.from, b.to);
        const monthTime = timeEntries.filter((t) => t.entry_date >= b.from && t.entry_date <= b.to);
        return { month: m, pnl: computePnl(monthEntries, monthTime) };
      })
    : [];

  // ── Para la pestaña "mes": evolución últimos N meses (toda la plataforma) ─
  let rollingHistory: { month: string; pnl: ReturnType<typeof computePnl> }[] = [];
  if (range === "month") {
    // Cargamos toda la plataforma (puede ser muchos meses, pero limitamos a 12 más recientes)
    const last12 = months.slice(0, 12);
    const first = monthBounds(last12[last12.length - 1]).from;
    const lastTo = monthBounds(last12[0]).to;

    const [{ data: histRows }, { data: histTimeRows }] = await Promise.all([
      admin.from("finance_entries").select("*").gte("entry_date", first).lte("entry_date", lastTo),
      admin.from("time_entries").select("*").gte("entry_date", first).lte("entry_date", lastTo),
    ]);

    const histEntries = (histRows ?? []) as FinanceEntry[];
    const histTime = normalizeTime((histTimeRows ?? []) as Array<{ hours: string | number; hourly_cost_snapshot: string | number | null } & Record<string, unknown>>);

    rollingHistory = last12.map((m) => {
      const b = monthBounds(m);
      const monthEntries = filterByDateRange(histEntries, b.from, b.to);
      const monthTime = histTime.filter((t) => t.entry_date >= b.from && t.entry_date <= b.to);
      return { month: m, pnl: computePnl(monthEntries, monthTime) };
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Selector de periodo ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4">
          <form className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Rango</label>
              <select
                name="range"
                defaultValue={range}
                className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="month">Por mes</option>
                <option value="year">Por año</option>
              </select>
            </div>

            {range === "month" ? (
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
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-medium">Año</label>
                <select
                  name="year"
                  defaultValue={String(selectedYear)}
                  className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Aplicar
            </button>
          </form>
          {range === "year" && selectedYear === PLATFORM_START_YEAR && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Año {selectedYear} muestra desde mayo (inicio de actividad en la plataforma).
              A partir de 2027, el año se mostrará completo (Enero - Diciembre).
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Tabla P&L del periodo ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            P&L — {range === "year" ? `Año ${selectedYear}` : monthLabel(selectedMonth)}
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

      {/* ── Vista año: tabla mes a mes del año seleccionado ─────────────── */}
      {range === "year" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Evolución mensual {selectedYear}
            </CardTitle>
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
                  {monthlyForYear.map(({ month, pnl: p }) => (
                    <tr key={month} className="hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap capitalize">{monthShortLabel(month)}</td>
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
                  {/* Fila total año */}
                  <tr className="border-t-2 border-primary/30 bg-primary/5 font-semibold">
                    <td className="px-3 py-2">Total {selectedYear}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{eur(pnl.totals.totalIncome)}</td>
                    <td className="px-3 py-2 text-right font-mono text-orange-600">{eur(pnl.totals.totalVariableCost)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${pnl.totals.grossMargin < 0 ? "text-red-600" : ""}`}>
                      {eur(pnl.totals.grossMargin)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${pnl.totals.grossMargin < 0 ? "text-red-600" : ""}`}>
                      {pct(pnl.totals.grossMarginPct)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-orange-600">{eur(pnl.totals.totalOpex)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${pnl.totals.netMargin < 0 ? "text-red-600" : ""}`}>
                      {eur(pnl.totals.netMargin)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${pnl.totals.netMargin < 0 ? "text-red-600" : ""}`}>
                      {pct(pnl.totals.netMarginPct)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Vista mes: rolling 12 meses ──────────────────────────────────── */}
      {range === "month" && rollingHistory.length > 0 && (
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
                  {rollingHistory.map(({ month, pnl: p }) => (
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
      )}
    </div>
  );
}
