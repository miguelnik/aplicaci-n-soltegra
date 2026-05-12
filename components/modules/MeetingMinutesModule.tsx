// Módulo: Actas de reunión / visita
// Lista de actas con fecha, asistentes, resumen y puntos de acción.

import { FileText, Download, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
}

export function MeetingMinutesModule({ module: mod, data }: Props) {
  const { meetingMinutes } = data;
  const sorted =
    meetingMinutes && meetingMinutes.length > 0
      ? [...meetingMinutes].sort(
          (a, b) =>
            new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime(),
        )
      : [];

  return (
    <section aria-labelledby="minutes-heading" className="space-y-3">
      <h2 id="minutes-heading" className="flex items-center gap-2 text-lg font-semibold">
        <FileText className="h-5 w-5 text-muted-foreground" />
        {mod.label}
      </h2>

      {sorted.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no hay actas registradas.
        </p>
      )}

      <ul className="space-y-4">
        {sorted.map((m) => (
          <li
            key={m.id}
            className="rounded-lg border bg-card px-4 py-4 shadow-sm"
          >
            {/* Cabecera */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{m.title}</p>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(m.meeting_date), "d 'de' MMMM 'de' yyyy", {
                    locale: es,
                  })}
                </p>
              </div>
              {m.signedUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={m.signedUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Descargar acta
                  </a>
                </Button>
              )}
            </div>

            {/* Asistentes */}
            {m.attendees && m.attendees.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                <span>{m.attendees.join(", ")}</span>
              </div>
            )}

            {/* Resumen */}
            {m.summary && (
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                {m.summary}
              </p>
            )}

            {/* Puntos de acción */}
            {m.action_points && m.action_points.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Puntos de acción
                </p>
                <ul className="space-y-1">
                  {m.action_points.map((ap, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {ap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
