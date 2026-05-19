// ============================================================================
// Tipos de imputación de horas y cálculo de rentabilidad real por proyecto.
// Se corresponden con la tabla time_entries (migración 0016).
// ============================================================================

export interface TimeEntry {
  id: string;
  worker_id: string;
  request_id: string | null;
  entry_date: string;          // ISO YYYY-MM-DD
  hours: number;
  description: string | null;
  hourly_cost_snapshot: number | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryWithWorker extends TimeEntry {
  worker_name: string | null;
}

/** Resultado del cálculo de rentabilidad real de un proyecto */
export interface ProjectProfitability {
  /** Precio acordado del proyecto (config) */
  price: number;
  /** Suma de horas directas imputadas al proyecto */
  directHours: number;
  /** Coste directo (suma de horas × tarifa snapshot) */
  directLaborCost: number;
  /** Coste indirecto prorrateado de los proyectos overhead */
  indirectLaborCost: number;
  /** Coste total de mano de obra (directo + indirecto) */
  totalLaborCost: number;
  /** Gastos directos contabilizados imputados a este proyecto */
  directExpenses: number;
  /** Beneficio real = precio - costes mano de obra - gastos directos */
  realProfit: number;
  /** Margen real en % sobre precio */
  realMarginPct: number;
}

/** Inputs para computeProjectProfitability */
export interface ProfitabilityInputs {
  price: number | null;
  directTimeEntries: TimeEntry[];
  overheadTimeEntries: TimeEntry[];
  /** Cuántos proyectos activos hay (para la prorrata) */
  activeProjectsCount: number;
  /** Gastos directos contabilizados */
  directExpenses: number;
}

/** Calcula la rentabilidad real de un proyecto.
 *  - Coste directo = sum(horas directas × hourly_cost_snapshot)
 *  - Coste indirecto = sum(horas overhead × tarifa) / proyectosActivos
 *  - Beneficio real = precio - costes mano de obra - gastos directos
 */
export function computeProjectProfitability(
  i: ProfitabilityInputs,
): ProjectProfitability {
  const price = i.price ?? 0;

  const directHours = i.directTimeEntries.reduce((a, e) => a + Number(e.hours), 0);
  const directLaborCost = i.directTimeEntries.reduce(
    (a, e) => a + Number(e.hours) * Number(e.hourly_cost_snapshot ?? 0),
    0,
  );

  const totalOverheadCost = i.overheadTimeEntries.reduce(
    (a, e) => a + Number(e.hours) * Number(e.hourly_cost_snapshot ?? 0),
    0,
  );
  const indirectLaborCost = i.activeProjectsCount > 0
    ? totalOverheadCost / i.activeProjectsCount
    : 0;

  const totalLaborCost = directLaborCost + indirectLaborCost;
  const realProfit = price - totalLaborCost - i.directExpenses;
  const realMarginPct = price > 0 ? (realProfit / price) * 100 : 0;

  return {
    price,
    directHours,
    directLaborCost,
    indirectLaborCost,
    totalLaborCost,
    directExpenses: i.directExpenses,
    realProfit,
    realMarginPct,
  };
}
