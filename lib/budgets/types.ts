// ============================================================================
// Tipos del sistema de presupuestos.
// Corresponden con las tablas creadas en 0020.
// ============================================================================

export type BudgetStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  draft:    "Borrador",
  sent:     "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  expired:  "Expirado",
};

export const BUDGET_STATUS_COLOR: Record<BudgetStatus, string> = {
  draft:    "bg-slate-100 text-slate-700 border-slate-200",
  sent:     "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  expired:  "bg-amber-50 text-amber-700 border-amber-200",
};

export interface BudgetItem {
  id: string;
  budget_id: string;
  position: number;
  concept: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  discount_pct: number;
}

export interface Budget {
  id: string;
  number: string | null;
  year: number;
  contact_id: string | null;
  organization_id: string | null;
  opportunity_id: string | null;
  converted_to_request_id: string | null;
  client_legal_name: string | null;
  client_cif: string | null;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
  title: string;
  intro: string | null;
  vat_pct: number;
  issue_date: string;
  valid_until: string | null;
  status: BudgetStatus;
  payment_terms: string | null;
  legal_notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetWithRelations extends Budget {
  contact_name?: string | null;
  organization_name?: string | null;
  owner_name?: string | null;
  opportunity_title?: string | null;
  items?: BudgetItem[];
}

export interface BudgetTemplate {
  id: string;
  name: string;
  description: string | null;
  service_type_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetTemplateItem {
  id: string;
  template_id: string;
  position: number;
  concept: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  discount_pct: number;
}

export interface BudgetTemplateWithItems extends BudgetTemplate {
  items?: BudgetTemplateItem[];
  service_name?: string | null;
  items_count?: number;
}

export interface BudgetConcept {
  id: string;
  concept: string;
  description: string | null;
  unit: string | null;
  unit_price: number;
  default_quantity: number;
  service_type_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetConceptWithService extends BudgetConcept {
  service_name?: string | null;
}

export interface CompanySettings {
  id: string;
  legal_name: string;
  trade_name: string | null;
  cif: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  iban: string | null;
  payment_terms: string | null;
  legal_notes: string | null;
  default_vat: number;
  budget_prefix: string;
  created_at: string;
  updated_at: string;
}

// ── Cálculo de totales ───────────────────────────────────────────────────────

export interface BudgetTotals {
  subtotal: number;            // suma líneas sin descuento
  totalDiscount: number;       // descuentos totales
  base: number;                // subtotal - descuento = base imponible
  vatAmount: number;           // IVA aplicado sobre base
  total: number;               // base + IVA
}

export function computeItemBase(item: { quantity: number; unit_price: number; discount_pct: number }): number {
  const gross = Number(item.quantity) * Number(item.unit_price);
  const discount = gross * (Number(item.discount_pct) / 100);
  return gross - discount;
}

export function computeBudgetTotals(items: BudgetItem[] | BudgetTemplateItem[], vatPct: number): BudgetTotals {
  let subtotal = 0;
  let totalDiscount = 0;
  for (const it of items) {
    const gross = Number(it.quantity) * Number(it.unit_price);
    const discount = gross * (Number(it.discount_pct) / 100);
    subtotal += gross;
    totalDiscount += discount;
  }
  const base = subtotal - totalDiscount;
  const vatAmount = base * (Number(vatPct) / 100);
  const total = base + vatAmount;
  return { subtotal, totalDiscount, base, vatAmount, total };
}
