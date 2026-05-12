// Módulo: Resumen económico / control de costes
// Muestra presupuesto inicial vs. costes reales aprobados/totales.
// Por defecto solo visible al admin.

import { Euro, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";
import type { CostCategory } from "@/lib/modules/expedition-types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
}

const CATEGORY_LABELS: Record<CostCategory, string> = {
  labor:       "Mano de obra",
  materials:   "Materiales",
  equipment:   "Equipos",
  subcontract: "Subcontratas",
  other:       "Otros",
};

function formatEur(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function EconomicSummaryModule({ module: mod, data }: Props) {
  const { budget, costItems } = data;

  if (!budget && (!costItems || costItems.length === 0)) return null;

  const totalCost = (costItems ?? []).reduce((acc, c) => acc + c.amount, 0);
  const approvedCost = (costItems ?? []).reduce(
    (acc, c) => acc + (c.is_approved ? c.amount : 0),
    0,
  );
  const initialBudget = budget?.initial_budget ?? null;
  const deviation = initialBudget != null ? totalCost - initialBudget : null;
  const currency = budget?.currency ?? "EUR";

  // Agrupar por categoría
  const byCategory = (costItems ?? []).reduce<Record<string, number>>(
    (acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + c.amount;
      return acc;
    },
    {},
  );

  return (
    <section aria-labelledby="economic-heading" className="space-y-4">
      <h2
        id="economic-heading"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <Euro className="h-5 w-5 text-muted-foreground" />
        {mod.label}
      </h2>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {initialBudget != null && (
          <div className="rounded-lg border bg-card p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Presupuesto inicial</p>
            <p className="mt-0.5 text-lg font-bold">
              {formatEur(initialBudget, currency)}
            </p>
          </div>
        )}

        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Coste total registrado</p>
          <p className="mt-0.5 text-lg font-bold">{formatEur(totalCost, currency)}</p>
        </div>

        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Coste aprobado</p>
          <p className="mt-0.5 text-lg font-bold text-green-700">
            {formatEur(approvedCost, currency)}
          </p>
        </div>

        {deviation != null && (
          <div
            className={`rounded-lg border p-3 shadow-sm ${
              deviation > 0
                ? "border-red-200 bg-red-50"
                : deviation < 0
                ? "border-green-200 bg-green-50"
                : "bg-card"
            }`}
          >
            <p className="text-xs text-muted-foreground">Desviación</p>
            <div className="mt-0.5 flex items-center gap-1">
              {deviation > 0 ? (
                <TrendingUp className="h-4 w-4 text-red-600" />
              ) : deviation < 0 ? (
                <TrendingDown className="h-4 w-4 text-green-600" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
              <p
                className={`text-lg font-bold ${
                  deviation > 0
                    ? "text-red-600"
                    : deviation < 0
                    ? "text-green-700"
                    : ""
                }`}
              >
                {deviation >= 0 ? "+" : ""}
                {formatEur(deviation, currency)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Desglose por categoría */}
      {Object.keys(byCategory).length > 0 && (
        <div className="rounded-lg border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                  Categoría
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                  Importe
                </th>
                {initialBudget != null && (
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                    % s/presupuesto
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(byCategory).map(([cat, amount]) => (
                <tr key={cat}>
                  <td className="px-4 py-2">
                    {CATEGORY_LABELS[cat as CostCategory] ?? cat}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatEur(amount, currency)}
                  </td>
                  {initialBudget != null && (
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {((amount / initialBudget) * 100).toFixed(1)}%
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/20 font-semibold">
              <tr>
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatEur(totalCost, currency)}
                </td>
                {initialBudget != null && (
                  <td className="px-4 py-2 text-right">
                    {((totalCost / initialBudget) * 100).toFixed(1)}%
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Notas del presupuesto */}
      {budget?.notes && (
        <p className="text-sm text-muted-foreground">{budget.notes}</p>
      )}

      {/* Detalle de partidas */}
      {costItems && costItems.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-primary">
            Ver partidas individuales ({costItems.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {costItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  {item.is_approved ? (
                    <Badge variant="secondary" className="text-[10px]">Aprobado</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Pendiente</Badge>
                  )}
                  <span>{item.description}</span>
                </div>
                <span className="font-mono font-medium">
                  {formatEur(item.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
