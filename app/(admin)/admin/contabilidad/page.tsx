import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, CircleDashed, AlertTriangle } from "lucide-react";
import type { FinanceEntry } from "@/lib/finance/types";
import {
  computePnl,
  filterByDateRange,
  monthBounds,
  currentMonth,
  monthLabel,
} from "@/lib/finance/pnl";

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});
const pct = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;

function Kpi({
  label, value, subtitle, color = "default", icon: Icon,
}: {
  label: string;
  value: string;
  subtitle?: string;
  color?: "default" | "green" | "red" | "orange";
  icon: typeof TrendingUp;
}) {
  const colorClass =
    color === "green"  ? "text-green-700" :
    color === "red"    ? "text-red-600" :
    color === "orange" ? "text-orange-600" :
                          "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          <Icon className="h-4 w-4" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`font-mono text-2xl font-bold ${colorClass}`}>{value}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export const dynamic = "force-dynamic";

export default async function ContabilidadDashboardPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  // Cargar TODOS los apuntes (luego filtramos por rangos en memoria)
  const { data: rows, error: queryError } = await admin
    .from("finance_entries")
    .select("*")
    .order("entry_date", { ascending: false });

  if (queryError) {
    throw new Error(
      `Error consultando finance_entries: ${queryError.message} (code: ${queryError.code}). ¿Has ejecutado la migración 0014_erp_foundations.sql?`,
    );
  }

  const entries = (rows ?? []) as FinanceEntry[];

  // ── Rangos ─────────────────────────────────────────────────────────────
  const monthKey = currentMonth();
  const { from: fromMonth, to: toMonth } = monthBounds(monthKey);

  // Últimos 12 meses
  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(today.getFullYear() - 1);
  const fromYear = yearAgo.toISOString().slice(0, 10);
  const toYear = today.toISOString().slice(0, 10);

  // ── Subconjuntos ───────────────────────────────────────────────────────
  const monthEntries = filterByDateRange(entries, fromMonth, toMonth);
  const yearEntries  = filterByDateRange(entries, fromYear,  toYear);

  const monthPnl = computePnl(monthEntries);
  const yearPnl  = computePnl(yearEntries);

  // ── Pendientes ─────────────────────────────────────────────────────────
  const pendingIncome = entries
    .filter((e) => e.kind === "income" && !e.is_settled)
    .reduce((a, e) => a + Number(e.amount), 0);
  const pendingIncomeCount = entries.filter((e) => e.kind === "income" && !e.is_settled).length;

  const pendingExpense = entries
    .filter((e) => e.kind === "expense" && !e.is_settled)
    .reduce((a, e) => a + Number(e.amount), 0);
  const pendingExpenseCount = entries.filter((e) => e.kind === "expense" && !e.is_settled).length;

  return (
    <div className="space-y-6">
      {/* ── KPIs mes en curso ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Mes en curso — {monthLabel(monthKey)}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Ingresos"
            value={eur(monthPnl.totals.totalIncome)}
            icon={TrendingUp}
            color="green"
          />
          <Kpi
            label="Gastos"
            value={eur(monthPnl.totals.totalVariableCost + monthPnl.totals.totalFixedCost)}
            icon={TrendingDown}
            color="orange"
          />
          <Kpi
            label="Margen bruto"
            value={eur(monthPnl.totals.grossMargin)}
            subtitle={pct(monthPnl.totals.grossMarginPct) + " sobre ingresos"}
            color={monthPnl.totals.grossMargin >= 0 ? "green" : "red"}
            icon={Wallet}
          />
          <Kpi
            label="Margen neto"
            value={eur(monthPnl.totals.netMargin)}
            subtitle={pct(monthPnl.totals.netMarginPct) + " sobre ingresos"}
            color={monthPnl.totals.netMargin >= 0 ? "green" : "red"}
            icon={Wallet}
          />
        </div>
      </section>

      {/* ── KPIs últimos 12 meses ───────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Últimos 12 meses
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Ingresos 12M"
            value={eur(yearPnl.totals.totalIncome)}
            icon={TrendingUp}
            color="green"
          />
          <Kpi
            label="Gastos 12M"
            value={eur(yearPnl.totals.totalVariableCost + yearPnl.totals.totalFixedCost)}
            icon={TrendingDown}
            color="orange"
          />
          <Kpi
            label="Margen bruto 12M"
            value={eur(yearPnl.totals.grossMargin)}
            subtitle={pct(yearPnl.totals.grossMarginPct)}
            color={yearPnl.totals.grossMargin >= 0 ? "green" : "red"}
            icon={Wallet}
          />
          <Kpi
            label="Margen neto 12M"
            value={eur(yearPnl.totals.netMargin)}
            subtitle={pct(yearPnl.totals.netMarginPct)}
            color={yearPnl.totals.netMargin >= 0 ? "green" : "red"}
            icon={Wallet}
          />
        </div>
      </section>

      {/* ── Pendientes ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Pendientes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Pendiente de cobro</span>
                <CircleDashed className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-bold text-green-700">{eur(pendingIncome)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingIncomeCount} apunte{pendingIncomeCount !== 1 ? "s" : ""} sin cobrar
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Pendiente de pago</span>
                <AlertTriangle className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-bold text-orange-600">{eur(pendingExpense)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingExpenseCount} apunte{pendingExpenseCount !== 1 ? "s" : ""} sin pagar
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {entries.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Todavía no hay ningún apunte contable.{" "}
          <a href="/admin/contabilidad/nueva" className="text-primary hover:underline">
            Crear el primero →
          </a>
        </div>
      )}
    </div>
  );
}
