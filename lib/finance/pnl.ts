// ============================================================================
// Lógica de cálculo del P&L (Profit & Loss) mensual.
// Toma una lista de finance_entries y devuelve la estructura agregada
// con los puntos exactos que pide el negocio:
//   Ingresos (certificados, proyectos, obra, arquitectura, otros)
//   Costes variables (movilidad, subcontratas)
//   Margen bruto € y %
//   Costes fijos (sueldos, administración, activos, otros)
//   Opex total
//   Margen neto € y %
// ============================================================================

import type {
  FinanceEntry, IncomeCategory, ExpenseCategory,
} from "./types";

export interface PnlRow {
  /** Etiqueta visible */
  label: string;
  /** Categoría interna (opcional) */
  key?: string;
  /** Importe (siempre positivo) */
  amount: number;
  /** Tipo de línea para estilado */
  type: "income" | "expense" | "subtotal" | "total" | "margin" | "margin_pct";
  /** Indentación visual */
  indent?: number;
  /** Es total/subtotal en negrita */
  bold?: boolean;
}

export interface PnlResult {
  /** Filas para renderizar en una tabla */
  rows: PnlRow[];
  /** Valores agregados (útiles para tarjetas/KPIs aparte) */
  totals: {
    totalIncome: number;
    totalVariableCost: number;
    grossMargin: number;
    grossMarginPct: number;
    totalFixedCost: number;
    totalOpex: number;       // = grossMargin - totalFixedCost? no: opex = total expenses fijos. Margen neto = bruto - fijos.
    netMargin: number;
    netMarginPct: number;
  };
}

// Helpers
const sum = (xs: FinanceEntry[]) => xs.reduce((a, e) => a + Number(e.amount), 0);
const filterIncome   = (xs: FinanceEntry[], c: IncomeCategory)   => xs.filter((e) => e.kind === "income"  && e.category === c);
const filterExpense  = (xs: FinanceEntry[], c: ExpenseCategory)  => xs.filter((e) => e.kind === "expense" && e.category === c);

const INCOME_ROWS: { key: IncomeCategory; label: string }[] = [
  { key: "certificate",  label: "Certificados energéticos" },
  { key: "project",      label: "Proyectos" },
  { key: "construction", label: "Gestión de obra" },
  { key: "architecture", label: "Arquitectura" },
  { key: "other",        label: "Otros ingresos" },
];

const VARIABLE_COST_ROWS: { key: ExpenseCategory; label: string }[] = [
  { key: "mobility",      label: "Movilidad" },
  { key: "subcontractor", label: "Subcontratas" },
];

const FIXED_COST_ROWS: { key: ExpenseCategory; label: string }[] = [
  { key: "salaries", label: "Sueldos" },
  { key: "admin",    label: "Administración" },
  { key: "assets",   label: "Activos" },
  { key: "other",    label: "Otros gastos fijos" },
];

/** Calcula el P&L a partir de una lista de apuntes. */
export function computePnl(entries: FinanceEntry[]): PnlResult {
  // ── Ingresos ────────────────────────────────────────────────────────────
  const incomeRows: PnlRow[] = INCOME_ROWS.map((r) => ({
    label: r.label,
    key: r.key,
    amount: sum(filterIncome(entries, r.key)),
    type: "income",
    indent: 1,
  }));
  const totalIncome = incomeRows.reduce((a, r) => a + r.amount, 0);

  // ── Costes variables ────────────────────────────────────────────────────
  const variableRows: PnlRow[] = VARIABLE_COST_ROWS.map((r) => ({
    label: r.label,
    key: r.key,
    amount: sum(filterExpense(entries, r.key)),
    type: "expense",
    indent: 1,
  }));
  const totalVariableCost = variableRows.reduce((a, r) => a + r.amount, 0);

  // ── Margen bruto ────────────────────────────────────────────────────────
  const grossMargin = totalIncome - totalVariableCost;
  const grossMarginPct = totalIncome > 0 ? (grossMargin / totalIncome) * 100 : 0;

  // ── Costes fijos ────────────────────────────────────────────────────────
  // Por defecto "other" es fijo según EXPENSE_COST_TYPE
  const fixedRows: PnlRow[] = FIXED_COST_ROWS.map((r) => ({
    label: r.label,
    key: r.key,
    amount: sum(filterExpense(entries, r.key)),
    type: "expense",
    indent: 1,
  }));
  const totalFixedCost = fixedRows.reduce((a, r) => a + r.amount, 0);

  // Opex total = costes fijos
  const totalOpex = totalFixedCost;

  // ── Margen neto ─────────────────────────────────────────────────────────
  const netMargin = grossMargin - totalFixedCost;
  const netMarginPct = totalIncome > 0 ? (netMargin / totalIncome) * 100 : 0;

  // ── Construir filas para la tabla ───────────────────────────────────────
  const rows: PnlRow[] = [];

  rows.push({ label: "INGRESOS",          amount: totalIncome,       type: "subtotal", bold: true });
  rows.push(...incomeRows);
  rows.push({ label: "Total ingresos",    amount: totalIncome,       type: "subtotal", bold: true });

  rows.push({ label: "COSTES VARIABLES",  amount: totalVariableCost, type: "subtotal", bold: true });
  rows.push(...variableRows);
  rows.push({ label: "Total CV",          amount: totalVariableCost, type: "subtotal", bold: true });

  rows.push({ label: "Margen bruto (€)",  amount: grossMargin,       type: "margin",     bold: true });
  rows.push({ label: "Margen bruto (%)",  amount: grossMarginPct,    type: "margin_pct", bold: true });

  rows.push({ label: "COSTES FIJOS",      amount: totalFixedCost,    type: "subtotal", bold: true });
  rows.push(...fixedRows);
  rows.push({ label: "Opex total",        amount: totalOpex,         type: "subtotal", bold: true });

  rows.push({ label: "Margen neto (€)",   amount: netMargin,         type: "total",      bold: true });
  rows.push({ label: "Margen neto (%)",   amount: netMarginPct,      type: "margin_pct", bold: true });

  return {
    rows,
    totals: {
      totalIncome,
      totalVariableCost,
      grossMargin,
      grossMarginPct,
      totalFixedCost,
      totalOpex,
      netMargin,
      netMarginPct,
    },
  };
}

/** Filtra entradas por rango de fechas YYYY-MM-DD inclusivo. */
export function filterByDateRange(
  entries: FinanceEntry[],
  fromISO: string,
  toISO: string,
): FinanceEntry[] {
  return entries.filter((e) => e.entry_date >= fromISO && e.entry_date <= toISO);
}

/** Primer y último día de un mes YYYY-MM. */
export function monthBounds(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    from: `${y}-${mm}-01`,
    to:   `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

/** Mes actual en formato YYYY-MM */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Etiqueta legible "octubre 2026" para un YYYY-MM */
export function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}
