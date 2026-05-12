// Módulo: Mapa de riesgos
// Matriz probabilidad × impacto. Por defecto solo visible al admin.

import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";
import type { RiskLevel, RiskStatus } from "@/lib/modules/expedition-types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
}

const LEVEL_LABEL: Record<RiskLevel, string> = {
  low:    "Baja",
  medium: "Media",
  high:   "Alta",
};

const STATUS_CONFIG: Record<RiskStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  identified: { label: "Identificado", variant: "outline" },
  mitigated:  { label: "Mitigado",     variant: "secondary" },
  accepted:   { label: "Aceptado",     variant: "default" },
  closed:     { label: "Cerrado",      variant: "secondary" },
};

// Matriz de prioridad (prob × impact)
function riskPriority(prob: RiskLevel, impact: RiskLevel): "low" | "medium" | "high" | "critical" {
  const map: Record<string, "low" | "medium" | "high" | "critical"> = {
    "low-low": "low", "low-medium": "low", "low-high": "medium",
    "medium-low": "low", "medium-medium": "medium", "medium-high": "high",
    "high-low": "medium", "high-medium": "high", "high-high": "critical",
  };
  return map[`${prob}-${impact}`] ?? "medium";
}

const PRIORITY_COLORS: Record<string, string> = {
  low:      "text-muted-foreground border-muted",
  medium:   "text-orange-600 border-orange-300 bg-orange-50",
  high:     "text-red-600 border-red-300 bg-red-50",
  critical: "text-red-800 border-red-500 bg-red-100 font-semibold",
};

export function RisksModule({ module: mod, data }: Props) {
  const { risks } = data;
  if (!risks || risks.length === 0) return null;

  const active = risks.filter((r) => r.status !== "closed");

  return (
    <section aria-labelledby="risks-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 id="risks-heading" className="flex items-center gap-2 text-lg font-semibold">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          {mod.label}
        </h2>
        {active.length > 0 && (
          <Badge variant="outline">
            {active.length} activo{active.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <ul className="space-y-2">
        {risks.map((risk) => {
          const priority = riskPriority(risk.probability, risk.impact);
          const sCfg = STATUS_CONFIG[risk.status] ?? STATUS_CONFIG.identified;
          return (
            <li
              key={risk.id}
              className={`rounded-lg border px-4 py-3 ${PRIORITY_COLORS[priority]}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium leading-tight">{risk.title}</p>
                <Badge variant={sCfg.variant}>{sCfg.label}</Badge>
              </div>
              {risk.description && (
                <p className="mt-1 text-sm opacity-80">{risk.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs opacity-70">
                <span>Probabilidad: <strong>{LEVEL_LABEL[risk.probability]}</strong></span>
                <span>Impacto: <strong>{LEVEL_LABEL[risk.impact]}</strong></span>
              </div>
              {risk.mitigation && (
                <p className="mt-1.5 rounded bg-white/60 px-2 py-1 text-xs">
                  <span className="font-medium">Mitigación:</span> {risk.mitigation}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
