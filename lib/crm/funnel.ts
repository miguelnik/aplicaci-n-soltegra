// ============================================================================
// Cálculo de tasas de conversión del embudo de ventas.
//
// Funnel oficial: Contacto → Reunión → Oferta → Ganada / Perdido
//
// Para cada opportunity, miramos su historial completo de stages y
// determinamos cuál es el "stage máximo" que alcanzó. Después se agrupa
// para calcular cuántas avanzaron de cada paso al siguiente.
// ============================================================================

import type { OpportunityStage } from "./types";

/** Ranking de las stages del funnel.
 *  Los stages legacy ("lead", "negotiation") se mapean a su equivalente
 *  más cercano en el funnel nuevo para que los datos históricos sigan
 *  contando correctamente. */
export const STAGE_RANK: Record<OpportunityStage, number> = {
  lead:        1,    // se cuenta como "Contacto"
  contacted:   1,    // Contacto
  qualified:   2,    // Reunión
  proposal:    3,    // Oferta
  negotiation: 3,    // legacy — equivalente a "Oferta"
  won:         4,    // Ganada
  lost:       -1,    // Perdido (no entra en el ranking; se trata aparte)
};

/** Etapas activas del nuevo funnel en orden. */
export const FUNNEL_STAGES: { rank: number; key: OpportunityStage; label: string }[] = [
  { rank: 1, key: "contacted", label: "Contacto" },
  { rank: 2, key: "qualified", label: "Reunión" },
  { rank: 3, key: "proposal",  label: "Oferta" },
];

export interface FunnelStageStats {
  rank: number;
  key: OpportunityStage;
  label: string;
  /** Cuántas oportunidades alcanzaron este stage (o uno posterior) */
  entered: number;
  /** Cuántas avanzaron al siguiente (o ganaron) */
  advanced: number;
  /** Cuántas se perdieron parándose en este stage */
  lost: number;
  /** Cuántas siguen pendientes en este stage */
  stuck: number;
  /** % de las que entraron que avanzaron */
  conversionPct: number;
  /** % de drop-off (lost + stuck pendientes) */
  dropPct: number;
}

export interface FunnelResult {
  stages: FunnelStageStats[];
  /** Resumen */
  totalEntered: number;     // alguien que al menos llegó a Contacto
  totalWon: number;
  totalLost: number;
  totalActive: number;       // ni won ni lost
  overallWinRate: number;    // won / (won + lost)
}

/** Input por oportunidad para el cálculo */
export interface OpportunityForFunnel {
  id: string;
  owner_id: string | null;
  current_stage: OpportunityStage;
  /** Stages presentes en el historial (distintos, sin orden importa). */
  history_stages: OpportunityStage[];
}

/** Devuelve la stage de mayor rank que la oportunidad ha visitado, ignorando "lost". */
function maxRankReached(o: OpportunityForFunnel): number {
  let max = -1;
  const all = [o.current_stage, ...o.history_stages];
  for (const s of all) {
    if (s === "lost") continue;
    const r = STAGE_RANK[s] ?? -1;
    if (r > max) max = r;
  }
  return max;
}

export function computeFunnel(opps: OpportunityForFunnel[]): FunnelResult {
  // Pre-calcular por oportunidad
  const annotated = opps.map((o) => ({
    o,
    maxRank: maxRankReached(o),
    isLost: o.current_stage === "lost",
    isWon: o.current_stage === "won",
  }));

  const stages: FunnelStageStats[] = FUNNEL_STAGES.map((s, idx) => {
    const next = FUNNEL_STAGES[idx + 1];
    const nextRank = next ? next.rank : 4;        // si no hay siguiente, "won" (rank 4)

    const enteredOpps = annotated.filter((a) => a.maxRank >= s.rank);
    const entered = enteredOpps.length;

    // "Avanzaron": alcanzaron el siguiente stage o won
    const advanced = enteredOpps.filter((a) => a.maxRank >= nextRank || a.isWon).length;

    // "Perdidas en este stage": estado actual = lost AND maxRank == s.rank
    const lost = enteredOpps.filter((a) => a.isLost && a.maxRank === s.rank).length;

    // "Pendientes en este stage": estado actual rank == s.rank y no won/lost
    const stuck = enteredOpps.filter((a) => {
      if (a.isWon || a.isLost) return false;
      const curRank = STAGE_RANK[a.o.current_stage] ?? -1;
      return curRank === s.rank;
    }).length;

    const conversionPct = entered > 0 ? (advanced / entered) * 100 : 0;
    const dropPct = entered > 0 ? ((lost + stuck) / entered) * 100 : 0;

    return {
      rank: s.rank,
      key: s.key,
      label: s.label,
      entered,
      advanced,
      lost,
      stuck,
      conversionPct,
      dropPct,
    };
  });

  const totalEntered = annotated.filter((a) => a.maxRank >= 1).length;
  const totalWon = annotated.filter((a) => a.isWon).length;
  const totalLost = annotated.filter((a) => a.isLost).length;
  const totalActive = annotated.filter((a) => !a.isWon && !a.isLost).length;
  const closed = totalWon + totalLost;
  const overallWinRate = closed > 0 ? (totalWon / closed) * 100 : 0;

  return { stages, totalEntered, totalWon, totalLost, totalActive, overallWinRate };
}
