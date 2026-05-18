// ============================================================================
// Tipos del módulo de contabilidad interna (ERP).
// Se corresponden con la tabla finance_entries creada en 0014.
// ============================================================================

export type FinanceKind = "income" | "expense";

/** Categorías de ingresos según el P&L de Soltegra */
export type IncomeCategory =
  | "certificate"   // Certificados energéticos
  | "project"       // Proyectos
  | "construction"  // Gestión / dirección de obra
  | "architecture"  // Arquitectura
  | "other";

/** Categorías de gastos según el P&L de Soltegra */
export type ExpenseCategory =
  // Variables (impactan margen bruto)
  | "mobility"
  | "subcontractor"
  // Fijos (Opex)
  | "salaries"
  | "admin"
  | "assets"
  | "other";

/** Tipo de coste: variable (CV) o fijo (CF). Sólo aplica a gastos. */
export type CostType = "variable" | "fixed";

/** Apunte contable: ingreso o gasto. */
export interface FinanceEntry {
  id: string;
  kind: FinanceKind;
  category: IncomeCategory | ExpenseCategory;
  cost_type: CostType | null;
  amount: number;
  entry_date: string;        // ISO YYYY-MM-DD
  description: string | null;
  notes: string | null;
  is_settled: boolean;
  settled_at: string | null;
  request_id: string | null;
  organization_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Etiquetas legibles para UI ────────────────────────────────────────────────

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  certificate:  "Certificados energéticos",
  project:      "Proyectos",
  construction: "Gestión de obra",
  architecture: "Arquitectura",
  other:        "Otros",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  mobility:      "Movilidad",
  subcontractor: "Subcontratas",
  salaries:      "Sueldos",
  admin:         "Administración",
  assets:        "Activos",
  other:         "Otros",
};

/** Qué cost_type corresponde a cada categoría de gasto */
export const EXPENSE_COST_TYPE: Record<ExpenseCategory, CostType> = {
  mobility:      "variable",
  subcontractor: "variable",
  salaries:      "fixed",
  admin:         "fixed",
  assets:        "fixed",
  other:         "fixed",
};

/** Mapeo de slug de servicio → categoría de ingreso por defecto */
export function defaultIncomeCategoryForService(slug: string | null | undefined): IncomeCategory {
  if (!slug) return "other";
  if (slug.includes("certificado")) return "certificate";
  if (slug.includes("obra") || slug.includes("construc")) return "construction";
  if (slug.includes("arquitect")) return "architecture";
  if (slug.includes("proyecto")) return "project";
  return "other";
}
