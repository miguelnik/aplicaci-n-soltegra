// ============================================================================
// Helpers para la sección de "Tareas pendientes" del dashboard y de /admin/tareas.
//
// Unifica dos fuentes:
//   - user_tasks: tareas explícitas
//   - crm_opportunities.next_action: recordatorios implícitos de oportunidades
//
// Para no duplicar entidades, las recordatorios de oportunidades se exponen
// como un tipo "PendingItem" que incluye los user_tasks normales también.
// ============================================================================

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TaskPriority, UserTaskWithRelations } from "./types";

export type PendingSource = "task" | "opportunity";

export interface PendingItem {
  source: PendingSource;
  /** id estable: para tasks el id de user_tasks, para opportunities el id de la oportunidad */
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;          // ISO datetime
  priority: TaskPriority;
  assignee_id: string;
  assignee_name: string | null;
  creator_name: string | null;
  /** href clicable al detalle correspondiente */
  href: string;
  opportunity_id: string | null;
  contact_id: string | null;
  request_id: string | null;
  status: "pending" | "done";
}

/** Carga las tareas asignadas a `userId` (pending) + recordatorios de
 *  oportunidades cuyo owner es `userId`. Si superadmin=true, carga TODAS.
 *  Las oportunidades sólo se incluyen si tienen next_action y next_action_due.
 */
export async function loadPendingFor(
  userId: string,
  isSuperadmin: boolean,
): Promise<PendingItem[]> {
  const admin = createSupabaseAdminClient();

  // 1. user_tasks pending
  let taskQuery = admin
    .from("user_tasks")
    .select(`
      *,
      assignee:assignee_id ( full_name ),
      creator:created_by ( full_name )
    `)
    .eq("status", "pending")
    .order("due_at", { ascending: true, nullsFirst: false });

  if (!isSuperadmin) {
    // Sólo las que son mías o que yo he creado
    taskQuery = taskQuery.or(`assignee_id.eq.${userId},created_by.eq.${userId}`);
  }

  const { data: tasks } = await taskQuery;

  const taskItems: PendingItem[] = (tasks ?? []).map((t) => {
    const assignee = (t.assignee as { full_name?: string | null } | null);
    const creator  = (t.creator  as { full_name?: string | null } | null);
    const href = t.opportunity_id
      ? `/admin/crm/oportunidades/${t.opportunity_id}`
      : t.contact_id
        ? `/admin/crm/contactos/${t.contact_id}`
        : t.request_id
          ? `/admin/solicitudes/${t.request_id}`
          : `/admin/tareas`;
    return {
      source: "task",
      id: t.id,
      title: t.title,
      description: t.description,
      due_at: t.due_at,
      priority: t.priority,
      assignee_id: t.assignee_id,
      assignee_name: assignee?.full_name ?? null,
      creator_name: creator?.full_name ?? null,
      href,
      opportunity_id: t.opportunity_id,
      contact_id: t.contact_id,
      request_id: t.request_id,
      status: "pending",
    };
  });

  // 2. Recordatorios de oportunidades (next_action + next_action_due)
  let oppQuery = admin
    .from("crm_opportunities")
    .select(`
      id, title, next_action, next_action_due, owner_id, contact_id,
      profiles:owner_id ( full_name )
    `)
    .not("next_action", "is", null)
    .not("next_action_due", "is", null)
    .not("stage", "in", "(won,lost)")
    .order("next_action_due", { ascending: true });

  if (!isSuperadmin) {
    oppQuery = oppQuery.eq("owner_id", userId);
  }

  const { data: opps } = await oppQuery;

  const oppItems: PendingItem[] = (opps ?? []).map((o) => {
    const owner = (o.profiles as { full_name?: string | null } | null);
    return {
      source: "opportunity",
      id: o.id,
      title: o.next_action!,
      description: `Oportunidad: ${o.title}`,
      due_at: o.next_action_due ? `${o.next_action_due}T09:00:00` : null,
      priority: "medium" as TaskPriority,
      assignee_id: o.owner_id ?? userId,
      assignee_name: owner?.full_name ?? null,
      creator_name: null,
      href: `/admin/crm/oportunidades/${o.id}`,
      opportunity_id: o.id,
      contact_id: o.contact_id,
      request_id: null,
      status: "pending",
    };
  });

  // 3. Ordenar todo por fecha (sin fecha al final)
  const all = [...taskItems, ...oppItems];
  all.sort((a, b) => {
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return 0;
  });

  return all;
}

/** Devuelve solo las tareas explícitas (no recordatorios), para gestión. */
export async function loadAllUserTasks(
  userId: string,
  isSuperadmin: boolean,
  showCompleted: boolean = false,
): Promise<UserTaskWithRelations[]> {
  const admin = createSupabaseAdminClient();

  let q = admin
    .from("user_tasks")
    .select(`
      *,
      assignee:assignee_id ( full_name ),
      creator:created_by ( full_name ),
      crm_opportunities:opportunity_id ( title ),
      crm_contacts:contact_id ( full_name ),
      certificate_requests:request_id ( reference_code, property_address )
    `)
    .order("status", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false });

  if (!showCompleted) q = q.eq("status", "pending");

  if (!isSuperadmin) {
    q = q.or(`assignee_id.eq.${userId},created_by.eq.${userId}`);
  }

  const { data } = await q;

  return (data ?? []).map((t) => {
    const assignee = (t.assignee as { full_name?: string | null } | null);
    const creator  = (t.creator  as { full_name?: string | null } | null);
    const opp      = (t.crm_opportunities as { title?: string | null } | null);
    const cont     = (t.crm_contacts as { full_name?: string | null } | null);
    const req      = (t.certificate_requests as { reference_code?: string | null; property_address?: string | null } | null);
    const requestLabel = req
      ? (req.reference_code ?? req.property_address ?? null)
      : null;
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      assignee_id: t.assignee_id,
      created_by: t.created_by,
      due_at: t.due_at,
      priority: t.priority,
      status: t.status,
      opportunity_id: t.opportunity_id,
      contact_id: t.contact_id,
      request_id: t.request_id,
      completed_at: t.completed_at,
      created_at: t.created_at,
      updated_at: t.updated_at,
      assignee_name: assignee?.full_name ?? null,
      creator_name: creator?.full_name ?? null,
      opportunity_title: opp?.title ?? null,
      contact_name: cont?.full_name ?? null,
      request_label: requestLabel,
    };
  });
}
