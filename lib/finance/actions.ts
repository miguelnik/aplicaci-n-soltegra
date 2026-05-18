"use server";

// ============================================================================
// Server Actions para apuntes contables (finance_entries).
// Sólo admin/superadmin. Se usan desde CRM, contabilidad y vista de proyecto.
// ============================================================================

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  FinanceKind,
  IncomeCategory,
  ExpenseCategory,
  CostType,
} from "./types";
import { EXPENSE_COST_TYPE } from "./types";

// ── Crear apunte ──────────────────────────────────────────────────────────────

export interface CreateFinanceEntryInput {
  kind: FinanceKind;
  category: IncomeCategory | ExpenseCategory;
  amount: number;
  entry_date: string;             // ISO YYYY-MM-DD
  description?: string | null;
  notes?: string | null;
  is_settled?: boolean;
  request_id?: string | null;
  organization_id?: string | null;
}

export async function createFinanceEntry(
  input: CreateFinanceEntryInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    // Validación básica
    if (!input.kind || !["income", "expense"].includes(input.kind)) {
      return { ok: false, error: "kind inválido" };
    }
    if (input.amount == null || Number.isNaN(input.amount) || input.amount < 0) {
      return { ok: false, error: "Importe inválido" };
    }
    if (!input.entry_date) {
      return { ok: false, error: "Fecha obligatoria" };
    }
    if (!input.category) {
      return { ok: false, error: "Categoría obligatoria" };
    }

    // cost_type se deriva automáticamente para gastos
    let cost_type: CostType | null = null;
    if (input.kind === "expense") {
      cost_type = EXPENSE_COST_TYPE[input.category as ExpenseCategory] ?? "fixed";
    }

    const { data, error } = await admin
      .from("finance_entries")
      .insert({
        kind: input.kind,
        category: input.category,
        cost_type,
        amount: input.amount,
        entry_date: input.entry_date,
        description: input.description?.trim() || null,
        notes: input.notes?.trim() || null,
        is_settled: input.is_settled ?? false,
        settled_at: input.is_settled ? new Date().toISOString() : null,
        request_id: input.request_id ?? null,
        organization_id: input.organization_id ?? null,
        created_by: me.id,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    // Refrescar páginas relevantes
    revalidatePath("/admin/contabilidad", "layout");
    if (input.organization_id) revalidatePath(`/admin/clientes/${input.organization_id}`);
    if (input.request_id) revalidatePath(`/admin/solicitudes/${input.request_id}`);

    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Marcar como cobrado / pagado ──────────────────────────────────────────────

export async function toggleFinanceEntrySettled(
  id: string,
  isSettled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { error } = await admin
      .from("finance_entries")
      .update({
        is_settled: isSettled,
        settled_at: isSettled ? new Date().toISOString() : null,
      })
      .eq("id", id);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/contabilidad", "layout");
    revalidatePath("/admin/clientes", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Eliminar apunte ───────────────────────────────────────────────────────────

export async function deleteFinanceEntry(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { error } = await admin.from("finance_entries").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/contabilidad", "layout");
    revalidatePath("/admin/clientes", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Actualizar campos editables ───────────────────────────────────────────────

export interface UpdateFinanceEntryInput {
  amount?: number;
  entry_date?: string;
  description?: string | null;
  notes?: string | null;
  category?: IncomeCategory | ExpenseCategory;
}

export async function updateFinanceEntry(
  id: string,
  patch: UpdateFinanceEntryInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    const payload: Record<string, unknown> = {};
    if ("amount" in patch && patch.amount != null) {
      if (Number.isNaN(patch.amount) || patch.amount < 0) {
        return { ok: false, error: "Importe inválido" };
      }
      payload.amount = patch.amount;
    }
    if ("entry_date" in patch && patch.entry_date) payload.entry_date = patch.entry_date;
    if ("description" in patch) payload.description = patch.description?.trim() || null;
    if ("notes" in patch) payload.notes = patch.notes?.trim() || null;

    // Si cambia la categoría y es de gasto, recalcular cost_type
    if ("category" in patch && patch.category) {
      payload.category = patch.category;
      // Saber el kind actual
      const { data: existing } = await admin
        .from("finance_entries")
        .select("kind")
        .eq("id", id)
        .single();
      if (existing?.kind === "expense") {
        payload.cost_type = EXPENSE_COST_TYPE[patch.category as ExpenseCategory] ?? "fixed";
      }
    }

    if (Object.keys(payload).length === 0) {
      return { ok: false, error: "Sin campos a actualizar" };
    }

    const { error } = await admin.from("finance_entries").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/contabilidad", "layout");
    revalidatePath("/admin/clientes", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
