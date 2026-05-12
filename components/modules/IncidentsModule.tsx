// Módulo: Registro de incidencias
// Muestra incidencias publicadas. Por defecto solo visible al admin.

import { AlertTriangle, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";
import type { IncidentSeverity, IncidentStatus } from "@/lib/modules/expedition-types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
}

const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  low:      { label: "Baja",     variant: "secondary" },
  medium:   { label: "Media",    variant: "outline" },
  high:     { label: "Alta",     variant: "default" },
  critical: { label: "Crítica",  variant: "destructive" },
};

const STATUS_ICONS: Record<IncidentStatus, React.ReactNode> = {
  open:        <AlertCircle className="h-4 w-4 text-orange-500" />,
  in_progress: <Clock className="h-4 w-4 text-blue-600" />,
  resolved:    <CheckCircle2 className="h-4 w-4 text-green-600" />,
  closed:      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open:        "Abierta",
  in_progress: "En gestión",
  resolved:    "Resuelta",
  closed:      "Cerrada",
};

export function IncidentsModule({ module: mod, data }: Props) {
  const { incidents } = data;
  if (!incidents || incidents.length === 0) return null;

  const open = incidents.filter((i) => i.status === "open" || i.status === "in_progress");

  return (
    <section aria-labelledby="incidents-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="incidents-heading" className="flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          {mod.label}
        </h2>
        {open.length > 0 && (
          <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
            {open.length} abierta{open.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <ul className="space-y-2">
        {incidents.map((inc) => {
          const sev = SEVERITY_CONFIG[inc.severity] ?? SEVERITY_CONFIG.medium;
          return (
            <li
              key={inc.id}
              className="rounded-lg border bg-card px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {STATUS_ICONS[inc.status]}
                  <div>
                    <p className="font-medium leading-tight">{inc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {STATUS_LABELS[inc.status]}
                      {inc.resolved_at &&
                        ` · ${format(parseISO(inc.resolved_at), "d MMM yyyy", { locale: es })}`}
                    </p>
                  </div>
                </div>
                <Badge variant={sev.variant}>{sev.label}</Badge>
              </div>
              {inc.description && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {inc.description}
                </p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                Registrada el{" "}
                {format(parseISO(inc.created_at), "d MMM yyyy", { locale: es })}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
