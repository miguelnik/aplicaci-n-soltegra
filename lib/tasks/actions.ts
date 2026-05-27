"use server";

// ============================================================================
// Server actions de tareas pendientes.
// Cualquier admin/superadmin puede crear tareas para sí o para otros.
// ============================================================================

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TaskPriority, TaskStatus } from "./types";

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  assigneeId?: string;             // si no se indica, el actual
  dueAt?: string | null;           // ISO datetime
  priority?: TaskPriority;
  opportunityId?: string | null;
  contactId?: string | null;
  requestId?: string | null;
}

export async function createUserTask(
  input: CreateTaskInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (!input.title?.trim()) return { ok: false, error: "Falta el título" };

    const { data, error } = await admin
      .from("user_tasks")
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        assignee_id: input.assigneeId ?? me.id,
        created_by: me.id,
        due_at: input.dueAt || null,
        priority: input.priority ?? "medium",
        status: "pending",
        opportunity_id: input.opportunityId || null,
        contact_id: input.contactId || null,
        request_id: input.requestId || null,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/tareas");
    revalidatePath("/admin/dashboard");
    if (input.opportunityId) revalidatePath(`/admin/crm/oportunidades/${input.opportunityId}`);
    if (input.contactId)     revalidatePath(`/admin/crm/contactos/${input.contactId}`);
    if (input.requestId)     revalidatePath(`/admin/solicitudes/${input.requestId}`);
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assigneeId?: string;
  dueAt?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
}

export async function updateUserTask(
  id: string,
  patch: UpdateTaskInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title.trim();
    if (patch.description !== undefined) payload.description = patch.description?.trim() || null;
    if (patch.assigneeId !== undefined) payload.assignee_id = patch.assigneeId;
    if (patch.dueAt !== undefined) payload.due_at = patch.dueAt || null;
    if (patch.priority !== undefined) payload.priority = patch.priority;
    if (patch.status !== undefined) payload.status = patch.status;

    if (Object.keys(payload).length === 0) return { ok: false, error: "Sin cambios" };

    const { error } = await admin.from("user_tasks").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/tareas");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleTaskDone(
  id: string,
  done: boolean,
): Promise<{ ok: boolean; error?: string }> {
  return updateUserTask(id, { status: done ? "done" : "pending" });
}

export async function deleteUserTask(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("user_tasks").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/tareas");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
