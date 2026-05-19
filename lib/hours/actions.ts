"use server";

// ============================================================================
// Server Actions de imputación de horas.
// Cualquier admin/superadmin puede imputar sus propias horas; el superadmin
// puede imputar/editar horas en nombre de cualquier trabajador.
// ============================================================================

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface CreateTimeEntryInput {
  workerId?: string;            // si no se indica, el usuario actual
  requestId: string | null;
  entryDate: string;            // YYYY-MM-DD
  hours: number;
  description?: string | null;
}

export async function createTimeEntry(
  input: CreateTimeEntryInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    // Validaciones
    if (input.hours == null || Number.isNaN(input.hours) || input.hours <= 0 || input.hours > 24) {
      return { ok: false, error: "Las horas deben estar entre 0.01 y 24" };
    }
    if (!input.entryDate) return { ok: false, error: "Falta la fecha" };

    // Worker objetivo: si no se especifica, el usuario actual
    const workerId = input.workerId ?? me.id;

    // Si imputas horas de otro, sólo superadmin
    if (workerId !== me.id && me.role !== "superadmin") {
      return { ok: false, error: "Solo el superadmin puede imputar horas en nombre de otro trabajador" };
    }

    // Snapshot del coste/hora del trabajador objetivo
    const { data: workerProfile } = await admin
      .from("profiles")
      .select("hourly_cost")
      .eq("id", workerId)
      .single();
    const snapshot = workerProfile?.hourly_cost ?? null;

    const { data, error } = await admin
      .from("time_entries")
      .insert({
        worker_id: workerId,
        request_id: input.requestId,
        entry_date: input.entryDate,
        hours: input.hours,
        description: input.description?.trim() || null,
        hourly_cost_snapshot: snapshot,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    if (input.requestId) revalidatePath(`/admin/solicitudes/${input.requestId}`);
    revalidatePath("/admin/horas");
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteTimeEntry(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    // Verificar propiedad si no es superadmin
    if (me.role !== "superadmin") {
      const { data: entry } = await admin
        .from("time_entries")
        .select("worker_id, request_id")
        .eq("id", id)
        .single();
      if (!entry) return { ok: false, error: "Apunte no encontrado" };
      if (entry.worker_id !== me.id) return { ok: false, error: "Sólo puedes borrar tus propias horas" };
    }

    const { error } = await admin.from("time_entries").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/horas");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Tarifa coste/hora ─────────────────────────────────────────────────────────

export async function updateWorkerHourlyCost(
  workerId: string,
  hourlyCost: number | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
    const admin = createSupabaseAdminClient();

    if (hourlyCost != null && (Number.isNaN(hourlyCost) || hourlyCost < 0)) {
      return { ok: false, error: "Tarifa inválida" };
    }

    const { error } = await admin
      .from("profiles")
      .update({ hourly_cost: hourlyCost })
      .eq("id", workerId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

