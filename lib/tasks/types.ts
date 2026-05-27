// ============================================================================
// Tipos del sistema de tareas pendientes (user_tasks).
// ============================================================================

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus   = "pending" | "done" | "dismissed";

export interface UserTask {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  created_by: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  opportunity_id: string | null;
  contact_id: string | null;
  request_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserTaskWithRelations extends UserTask {
  assignee_name?: string | null;
  creator_name?: string | null;
  opportunity_title?: string | null;
  contact_name?: string | null;
  request_label?: string | null;
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low:    "Baja",
  medium: "Media",
  high:   "Alta",
};

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low:    "border-slate-300 text-slate-600",
  medium: "border-blue-300 text-blue-700",
  high:   "border-rose-400 text-rose-600 bg-rose-50",
};

/** Devuelve si una tarea está vencida (due_at en el pasado y aún pending). */
export function isOverdue(t: UserTask): boolean {
  if (t.status !== "pending" || !t.due_at) return false;
  return new Date(t.due_at).getTime() < Date.now();
}

/** Devuelve si una tarea vence hoy (fecha local). */
export function isDueToday(t: UserTask): boolean {
  if (!t.due_at) return false;
  const d = new Date(t.due_at);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
}
