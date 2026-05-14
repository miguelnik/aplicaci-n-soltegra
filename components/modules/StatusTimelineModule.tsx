// Módulo: Estado / Timeline
// Si el servicio tiene fases configuradas (status_phases), las usa para el timeline.
// Si no, usa los pasos genéricos del sistema (submitted, in_review, in_progress, delivered).

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

// ── Timeline genérico (sin fases configuradas) ──────────────────────────────

const GENERIC_STEPS = [
  { key: "submitted",    label: "Solicitud recibida", shortLabel: "Recibida" },
  { key: "in_review",   label: "En revisión",         shortLabel: "Revisión" },
  { key: "in_progress", label: "En redacción",        shortLabel: "Redacción" },
  { key: "delivered",   label: "Entregado",           shortLabel: "Entregado" },
] as const;

type HistoryEntry = { status: string; at: string };

// ── Timeline genérico de estados del sistema ─────────────────────────────────

function GenericTimeline({
  status,
  history,
}: {
  status: string;
  history: HistoryEntry[];
}) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <XCircle className="h-4 w-4 shrink-0" />
        Solicitud cancelada.
      </div>
    );
  }

  const specialLabel =
    status === "awaiting_info"
      ? "Pendiente de información adicional de tu parte"
      : null;

  const currentIdx = GENERIC_STEPS.findIndex((s) => s.key === status);
  const activeIdx = status === "awaiting_info" ? 2 : currentIdx;

  const historyMap = new Map<string, string>();
  for (const entry of history) {
    if (!historyMap.has(entry.status)) {
      historyMap.set(entry.status, entry.at);
    }
  }

  return (
    <div className="space-y-3">
      {specialLabel && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          {specialLabel} — contacta con Soltegra para más información.
        </div>
      )}
      <div className="flex items-start gap-0">
        {GENERIC_STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          const dateStr = historyMap.get(step.key);

          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors ${
                    done
                      ? "border-primary bg-primary text-white"
                      : active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 bg-background text-muted-foreground/50"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`mt-1 text-center text-xs leading-tight ${
                    done || active
                      ? "font-medium text-foreground"
                      : "text-muted-foreground/50"
                  }`}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </span>
                {dateStr && (done || active) && (
                  <span className="mt-0.5 text-center text-[10px] text-muted-foreground">
                    {format(new Date(dateStr), "d MMM", { locale: es })}
                  </span>
                )}
              </div>
              {i < GENERIC_STEPS.length - 1 && (
                <div
                  className={`mx-1 mt-4 h-0.5 flex-1 ${
                    done ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Timeline de fases configuradas ──────────────────────────────────────────

interface StatusPhase {
  key: string;
  label: string;
  description?: string;
}

function CustomPhasesTimeline({
  phases,
  currentPhaseKey,
}: {
  phases: StatusPhase[];
  currentPhaseKey: string | null;
}) {
  if (!currentPhaseKey) {
    return (
      <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
        El equipo actualizará el estado del proyecto próximamente.
      </div>
    );
  }

  const currentIdx = phases.findIndex((p) => p.key === currentPhaseKey);

  return (
    <div className="flex items-start gap-0">
      {phases.map((phase, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;

        return (
          <div key={phase.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors ${
                  done
                    ? "border-primary bg-primary text-white"
                    : active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted-foreground/30 bg-background text-muted-foreground/50"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`mt-1 max-w-[80px] text-center text-xs leading-tight ${
                  done || active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground/50"
                }`}
              >
                {phase.label}
              </span>
              {active && phase.description && (
                <span className="mt-0.5 max-w-[90px] text-center text-[10px] text-muted-foreground">
                  {phase.description}
                </span>
              )}
            </div>
            {i < phases.length - 1 && (
              <div
                className={`mx-1 mt-4 h-0.5 flex-1 ${
                  done ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Módulo principal ─────────────────────────────────────────────────────────

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
}

export function StatusTimelineModule({ data }: Props) {
  const { req } = data;
  const isDraft = req.status === "draft";
  const isCancelled = req.status === "cancelled";

  // No renderizar en borrador ni cancelado (hay banners de sistema para eso)
  if (isDraft || isCancelled) return null;

  const history = (req.status_history ?? []) as HistoryEntry[];
  const phases = data.statusPhases ?? [];
  const useCustomPhases = phases.length > 0;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pb-4 pt-6">
          {useCustomPhases ? (
            <CustomPhasesTimeline
              phases={phases}
              currentPhaseKey={req.current_phase_key ?? null}
            />
          ) : (
            <GenericTimeline status={req.status} history={history} />
          )}
        </CardContent>
      </Card>

      {/* Fase actual (descripción) solo con timeline personalizado */}
      {useCustomPhases && req.current_phase_key && (() => {
        const activePhase = phases.find((p) => p.key === req.current_phase_key);
        return activePhase?.description ? (
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-4 py-2 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <strong>{activePhase.label}:</strong> {activePhase.description}
            </span>
          </div>
        ) : null;
      })()}

      {/* Fecha prevista de entrega */}
      {req.estimated_delivery_date && req.status !== "delivered" && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-4 py-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>
            Entrega prevista:{" "}
            <strong>
              {format(
                new Date(req.estimated_delivery_date),
                "d 'de' MMMM 'de' yyyy",
                { locale: es },
              )}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
