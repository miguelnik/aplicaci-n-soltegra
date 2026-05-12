// Módulo: Cuadro de mando de dirección de obra
// Vista agregada: progreso de hitos, incidencias abiertas, visitas recientes,
// y desviación económica. No requiere tabla propia — lee datos del ModulePageData.

import {
  CheckCircle2,
  AlertTriangle,
  HardHat,
  Euro,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
      <span className={`mt-0.5 ${colorClass ?? "text-muted-foreground"}`}>
        {icon}
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold leading-tight ${colorClass ?? ""}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function formatEur(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ConstructionDashboardModule({ module: mod, data }: Props) {
  const { milestones, incidents, siteVisits, budget, costItems } = data;

  // Calcular KPIs
  const totalMilestones = milestones?.length ?? 0;
  const completedMilestones = milestones?.filter((m) => m.status === "completed").length ?? 0;
  const delayedMilestones = milestones?.filter((m) => m.status === "delayed").length ?? 0;
  const progressPct = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : null;

  const openIncidents = incidents?.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  ).length ?? 0;

  const lastVisit = siteVisits && siteVisits.length > 0
    ? [...siteVisits].sort(
        (a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime(),
      )[0]
    : null;

  const totalCost = (costItems ?? []).reduce((acc, c) => acc + c.amount, 0);
  const deviation = budget?.initial_budget != null && totalCost > 0
    ? totalCost - budget.initial_budget
    : null;

  // Si no hay datos para mostrar, no renderizar
  const hasData =
    totalMilestones > 0 ||
    incidents?.length ||
    siteVisits?.length ||
    budget?.initial_budget != null;

  if (!hasData) return null;

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-4">
      <h2 id="dashboard-heading" className="text-lg font-semibold">
        {mod.label}
      </h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {progressPct != null && (
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Hitos completados"
            value={`${progressPct}%`}
            sub={`${completedMilestones} / ${totalMilestones}`}
            colorClass={
              progressPct === 100
                ? "text-green-600"
                : delayedMilestones > 0
                ? "text-orange-500"
                : "text-primary"
            }
          />
        )}

        {incidents !== undefined && (
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Incidencias abiertas"
            value={openIncidents}
            sub={openIncidents === 0 ? "Sin incidencias" : "requieren atención"}
            colorClass={
              openIncidents === 0
                ? "text-green-600"
                : openIncidents > 2
                ? "text-red-500"
                : "text-orange-500"
            }
          />
        )}

        {lastVisit && (
          <StatCard
            icon={<HardHat className="h-5 w-5" />}
            label="Última visita"
            value={format(parseISO(lastVisit.visited_at), "d MMM", { locale: es })}
            sub={lastVisit.technician}
            colorClass="text-muted-foreground"
          />
        )}

        {deviation != null && (
          <StatCard
            icon={
              deviation > 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )
            }
            label="Desviación económica"
            value={`${deviation >= 0 ? "+" : ""}${formatEur(deviation, budget?.currency)}`}
            sub={`sobre ${formatEur(budget!.initial_budget!, budget?.currency)}`}
            colorClass={deviation > 0 ? "text-red-600" : "text-green-700"}
          />
        )}
      </div>

      {/* Barra de progreso de hitos */}
      {totalMilestones > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Avance del proyecto</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {delayedMilestones > 0 && (
            <p className="mt-1 text-xs text-orange-500">
              {delayedMilestones} hito{delayedMilestones > 1 ? "s" : ""} con retraso
            </p>
          )}
        </div>
      )}

      {/* Próximos hitos */}
      {milestones && milestones.filter((m) => m.status !== "completed").length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Próximos hitos
          </p>
          <ul className="space-y-1.5">
            {milestones
              .filter((m) => m.status !== "completed" && m.status !== "closed" as string)
              .slice(0, 3)
              .map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-sm"
                >
                  <span
                    className={m.status === "delayed" ? "text-orange-600 font-medium" : ""}
                  >
                    {m.title}
                  </span>
                  {m.due_date && (
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(m.due_date), "d MMM", { locale: es })}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
