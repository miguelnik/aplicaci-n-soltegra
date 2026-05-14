// Módulo: Hitos del proyecto
// Muestra la línea de tiempo de hitos con su estado y fecha.

import { CheckCircle2, Circle, Clock, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";
import type { MilestoneStatus } from "@/lib/modules/expedition-types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
}

const STATUS_CONFIG: Record<
  MilestoneStatus,
  { label: string; icon: React.ReactNode; color: string }
> = {
  pending: {
    label: "Pendiente",
    icon: <Circle className="h-4 w-4" />,
    color: "text-muted-foreground",
  },
  in_progress: {
    label: "En progreso",
    icon: <Clock className="h-4 w-4" />,
    color: "text-blue-600",
  },
  completed: {
    label: "Completado",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-green-600",
  },
  delayed: {
    label: "Con retraso",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-red-500",
  },
};

function MilestoneItem({ m }: { m: Props["data"]["milestones"][number] }) {
  const cfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.pending;
  return (
    <li className="relative">
      <span
        className={`absolute -left-[1.45rem] flex h-6 w-6 items-center justify-center rounded-full border bg-background ${cfg.color}`}
      >
        {cfg.icon}
      </span>
      <div className={`rounded-md border bg-card px-4 py-3 shadow-sm ${m.status === "completed" ? "opacity-75" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium leading-tight">{m.title}</p>
          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
        </div>
        {m.description && (
          <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {m.due_date && (
            <span>
              Fecha prevista:{" "}
              <strong>{format(parseISO(m.due_date), "d MMM yyyy", { locale: es })}</strong>
            </span>
          )}
          {m.completed_at && (
            <span className="text-green-600">
              Completado: {format(parseISO(m.completed_at), "d MMM yyyy", { locale: es })}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function MilestonesModule({ module: mod, data }: Props) {
  const { milestones } = data;
  const sorted = milestones && milestones.length > 0
    ? [...milestones].sort((a, b) => a.order - b.order)
    : [];

  const active    = sorted.filter((m) => m.status !== "completed");
  const completed = sorted.filter((m) => m.status === "completed");

  return (
    <section aria-labelledby="milestones-heading" className="space-y-4">
      <h2 id="milestones-heading" className="text-lg font-semibold">{mod.label}</h2>

      {sorted.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no hay hitos definidos para este proyecto.
        </p>
      )}

      {/* Hitos activos / pendientes */}
      {active.length > 0 && (
        <ol className="relative border-l border-muted-foreground/20 pl-6 space-y-4">
          {active.map((m) => <MilestoneItem key={m.id} m={m} />)}
        </ol>
      )}

      {/* Hitos completados (siempre visibles) */}
      {completed.length > 0 && (
        <details open={active.length === 0} className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            {completed.length} hito{completed.length > 1 ? "s" : ""} completado{completed.length > 1 ? "s" : ""}
          </summary>
          <ol className="relative mt-3 border-l border-muted-foreground/20 pl-6 space-y-4">
            {completed.map((m) => <MilestoneItem key={m.id} m={m} />)}
          </ol>
        </details>
      )}
    </section>
  );
}
