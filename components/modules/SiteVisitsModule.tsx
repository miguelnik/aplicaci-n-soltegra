// Módulo: Visitas de obra
// Lista cronológica de visitas realizadas al emplazamiento.

import { HardHat, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { EntityAttachments } from "./EntityAttachments";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
  currentRole: "client" | "admin";
}

export function SiteVisitsModule({ module: mod, data, currentRole }: Props) {
  const { siteVisits, req } = data;
  const sorted = siteVisits && siteVisits.length > 0
    ? [...siteVisits].sort((a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime())
    : [];

  return (
    <section aria-labelledby="site-visits-heading" className="space-y-3">
      <h2 id="site-visits-heading" className="flex items-center gap-2 text-lg font-semibold">
        <HardHat className="h-5 w-5 text-muted-foreground" />
        {mod.label}
      </h2>

      {sorted.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no se han registrado visitas de obra.
        </p>
      )}

      <ol className="space-y-3">
        {sorted.map((visit) => (
          <li
            key={visit.id}
            className="rounded-lg border bg-card px-4 py-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(parseISO(visit.visited_at), "EEEE, d 'de' MMMM 'de' yyyy", {
                  locale: es,
                })}
              </div>
              <span className="text-sm text-muted-foreground">{visit.technician}</span>
            </div>
            {visit.observations && (
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                {visit.observations}
              </p>
            )}
            <EntityAttachments
              requestId={req.id}
              entityType="site_visit"
              entityId={visit.id}
              attachments={visit.attachments}
              canUpload={currentRole === "admin"}
              compact
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
