// ============================================================================
// Tipos del CRM.
// Corresponden con crm_contacts, crm_opportunities, crm_interactions (0018).
// ============================================================================

export type OpportunityStage =
  | "lead"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type InteractionKind =
  | "email"
  | "call"
  | "meeting"
  | "note"
  | "whatsapp"
  | "other";

export type InteractionDirection = "inbound" | "outbound";

// ── Etiquetas legibles ───────────────────────────────────────────────────────

export const STAGE_LABEL: Record<OpportunityStage, string> = {
  // Funnel actual
  contacted:   "Contacto",
  qualified:   "Reunión",
  proposal:    "Oferta",
  won:         "Ganada",
  lost:        "Perdido",
  // Legacy — sólo se muestran si hay datos históricos con estos estados
  lead:        "Lead",
  negotiation: "Negociación",
};

/** Orden visual de las columnas del Kanban (won/lost al final aparte) */
export const ACTIVE_STAGES: OpportunityStage[] = [
  "contacted", "qualified", "proposal",
];

/** Estados disponibles para elegir en formularios y dropdowns */
export const ALL_STAGES: OpportunityStage[] = [
  ...ACTIVE_STAGES, "won", "lost",
];

export const STAGE_COLOR: Record<OpportunityStage, string> = {
  // Funnel actual
  contacted:   "bg-blue-50 text-blue-700 border-blue-200",
  qualified:   "bg-indigo-50 text-indigo-700 border-indigo-200",
  proposal:    "bg-amber-50 text-amber-700 border-amber-200",
  won:         "bg-green-50 text-green-700 border-green-200",
  lost:        "bg-rose-50 text-rose-700 border-rose-200",
  // Legacy
  lead:        "bg-slate-100 text-slate-700 border-slate-200",
  negotiation: "bg-orange-50 text-orange-700 border-orange-200",
};

export const INTERACTION_KIND_LABEL: Record<InteractionKind, string> = {
  email:    "Email",
  call:     "Llamada",
  meeting:  "Reunión",
  note:     "Nota",
  whatsapp: "WhatsApp",
  other:    "Otro",
};

// ── Estructuras de datos ─────────────────────────────────────────────────────

export interface CrmContact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  organization_id: string | null;
  company_name: string | null;
  notes: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmOpportunity {
  id: string;
  title: string;
  contact_id: string | null;
  organization_id: string | null;
  owner_id: string | null;
  stage: OpportunityStage;
  service_type_id: string | null;
  estimated_value: number | null;
  expected_close_date: string | null;
  probability: number | null;
  next_action: string | null;
  next_action_due: string | null;
  notes: string | null;
  lost_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  won_at: string | null;
  lost_at: string | null;
  converted_to_request_id: string | null;
}

export interface CrmInteraction {
  id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  kind: InteractionKind;
  happened_at: string;
  subject: string | null;
  summary: string | null;
  direction: InteractionDirection | null;
  created_by: string | null;
  created_at: string;
}

// Versiones enriquecidas con joins (cuando se cargan con related data)

export interface CrmContactWithOwner extends CrmContact {
  owner_name?: string | null;
  organization_name?: string | null;
}

export interface CrmOpportunityWithRelations extends CrmOpportunity {
  contact_name?: string | null;
  contact_email?: string | null;
  organization_name?: string | null;
  owner_name?: string | null;
  service_name?: string | null;
}

export interface CrmInteractionWithAuthor extends CrmInteraction {
  author_name?: string | null;
  contact_name?: string | null;
  opportunity_title?: string | null;
}
