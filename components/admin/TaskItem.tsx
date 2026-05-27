"use client";

// Tarjeta de una tarea pendiente.
// Acepta tanto items de user_tasks como "recordatorios" de oportunidades.

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO, isPast, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Circle, Clock, Trash2, ExternalLink,
  User, FileText, Briefcase, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { toggleTaskDone, deleteUserTask } from "@/lib/tasks/actions";
import { PRIORITY_LABEL, PRIORITY_COLOR } from "@/lib/tasks/types";
import type { PendingItem } from "@/lib/tasks/dashboard";

interface Props {
  item: PendingItem;
  /** Mostrar el assignee (para vistas globales de superadmin). */
  showAssignee?: boolean;
  /** Permitir borrar (solo si el usuario actual es el creator o superadmin). */
  canDelete?: boolean;
}

export function TaskItem({ item, showAssignee = false, canDelete = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isReminder = item.source === "opportunity";

  const due = item.due_at ? parseISO(item.due_at) : null;
  const overdue = due && isPast(due) && !isToday(due);
  const todayDue = due && isToday(due);

  function markDone() {
    if (isReminder) {
      // Para recordatorios de oportunidades, "hecho" significa convertirlo en tarea archivada
      // Más simple: redirigir a la oportunidad para que actualice next_action manualmente
      toast.info("Edita la oportunidad para limpiar la próxima acción");
      return;
    }
    startTransition(async () => {
      const res = await toggleTaskDone(item.id, true);
      if (!res.ok) toast.error(res.error ?? "Error");
      else {
        toast.success("Tarea completada");
        router.refresh();
      }
    });
  }

  function remove() {
    if (isReminder) return;
    if (!confirm("¿Eliminar esta tarea?")) return;
    startTransition(async () => {
      const res = await deleteUserTask(item.id);
      if (!res.ok) toast.error(res.error ?? "Error");
      else {
        toast.success("Tarea eliminada");
        router.refresh();
      }
    });
  }

  const borderClass = overdue
    ? "border-rose-300 bg-rose-50/30"
    : todayDue
      ? "border-amber-300 bg-amber-50/30"
      : "border-border";

  return (
    <div className={`flex items-start gap-2 rounded-md border bg-card px-3 py-2 ${borderClass}`}>
      {/* Check toggle */}
      <button
        type="button"
        onClick={markDone}
        disabled={pending}
        className="mt-0.5 text-muted-foreground hover:text-green-600"
        title="Marcar como hecha"
      >
        <Circle className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium leading-tight">{item.title}</p>
          {isReminder && (
            <Badge variant="outline" className="border-indigo-300 text-[10px] text-indigo-700">
              Recordatorio
            </Badge>
          )}
          {!isReminder && (
            <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLOR[item.priority]}`}>
              {PRIORITY_LABEL[item.priority]}
            </Badge>
          )}
        </div>

        {item.description && (
          <p className="text-xs text-muted-foreground">{item.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {due && (
            <span className={`inline-flex items-center gap-1 ${overdue ? "font-medium text-rose-600" : todayDue ? "font-medium text-amber-700" : ""}`}>
              {overdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {overdue
                ? `Vencida ${format(due, "d MMM HH:mm", { locale: es })}`
                : todayDue
                  ? `Hoy ${format(due, "HH:mm", { locale: es })}`
                  : format(due, "d MMM yyyy · HH:mm", { locale: es })}
            </span>
          )}
          {showAssignee && item.assignee_name && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {item.assignee_name}
            </span>
          )}
          {item.opportunity_id && (
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              <Link href={item.href} className="text-primary hover:underline">Ver oportunidad</Link>
            </span>
          )}
          {item.contact_id && !item.opportunity_id && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              <Link href={item.href} className="text-primary hover:underline">Ver contacto</Link>
            </span>
          )}
          {item.request_id && (
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <Link href={item.href} className="text-primary hover:underline">Ver proyecto</Link>
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-0.5">
        {!isReminder && canDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={remove} disabled={pending}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {isReminder && (
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href={item.href}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
