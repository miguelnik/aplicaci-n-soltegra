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

export function MilestonesModule({ module: mod, data }: Props) {
  const { milestones } = data;
  if (!milestones || milestones.length === 0) return null;

  const sorted = [...milestones].sort((a, b) => a.order - b.order);

  return (
    <section aria-labelledby="milestones-heading" className="space-y-3">
      <h2 id="milestones-heading" className="text-lg font-semibold">
        {mod.label}
      </h2>
      <ol className="relative border-l border-muted-foreground/20 pl-6 space-y-4">
        {sorted.map((m) => {
          const cfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.pending;
          return (
            <li key={m.id} className="relative">
              <span
                className={`absolute -left-[1.45rem] flex h-6 w-6 items-center justify-center rounded-full border bg-background ${cfg.color}`}
              >
                {cfg.icon}
              </span>
              <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium leading-tight">{m.title}</p>
                  <span
                    className={`text-xs font-medium ${cfg.color}`}
                  >
                    {cfg.label}
                  </span>
                </div>
                {m.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {m.description}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {m.due_date && (
                    <span>
                      Fecha prevista:{" "}
                      <strong>
                        {format(parseISO(m.due_date), "d MMM yyyy", { locale: es })}
                      </strong>
                    </span>
                  )}
                  {m.completed_at && (
                    <span className="text-green-600">
                      Completado:{" "}
                      {format(parseISO(m.completed_at), "d MMM yyyy", { locale: es })}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
