// ============================================================================
// Tipos para los módulos de gestión de proyecto y dirección de obra.
// Corresponden a las tablas creadas en 0009_expedition_modules.sql.
// ============================================================================

export type MilestoneStatus = "pending" | "in_progress" | "completed" | "delayed";
export type DecisionStatus  = "pending" | "approved" | "rejected" | "deferred";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus  = "open" | "in_progress" | "resolved" | "closed";
export type RiskLevel       = "low" | "medium" | "high";
export type RiskStatus      = "identified" | "mitigated" | "accepted" | "closed";
export type CostCategory    = "labor" | "materials" | "equipment" | "subcontract" | "other";

// ── Hitos ────────────────────────────────────────────────────────────────────

export interface ExpeditionMilestone {
  id: string;
  request_id: string;
  title: string;
  description: string | null;
  due_date: string | null;        // ISO date YYYY-MM-DD
  completed_at: string | null;   // ISO datetime
  status: MilestoneStatus;
  is_visible_to_client: boolean;
  order: number;
  created_at: string;
  updated_at: string;
}

// ── Modificaciones (antes: Decisiones) ───────────────────────────────────────

export interface ExpeditionDecision {
  id: string;
  request_id: string;
  title: string;
  description: string | null;
  deadline: string | null;              // ISO date YYYY-MM-DD (legacy)
  status: DecisionStatus;
  client_response: string | null;       // legacy
  client_responded_at: string | null;   // legacy
  is_visible_to_client: boolean;
  created_at: string;
  updated_at: string;
  // Campos de workflow de modificaciones (0013)
  requested_by_id: string | null;
  requested_by_role: "client" | "admin" | null;
  cost: number | null;
  approved_at: string | null;
  approved_by_id: string | null;
  rejected_at: string | null;
  rejected_by_id: string | null;
  attachments?: ExpeditionAttachment[];
}

// ── Mensajes de modificación (conversación por modificación) ─────────────────

export interface ModificationMessage {
  id: string;
  modification_id: string;
  request_id: string;
  author_id: string | null;
  author_role: "client" | "admin";
  body: string;
  created_at: string;
}

// ── Incidencias ──────────────────────────────────────────────────────────────

export interface ExpeditionIncident {
  id: string;
  request_id: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  is_visible_to_client: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  attachments?: ExpeditionAttachment[];
}

// ── Riesgos ──────────────────────────────────────────────────────────────────

export interface ExpeditionRisk {
  id: string;
  request_id: string;
  title: string;
  description: string | null;
  probability: RiskLevel;
  impact: RiskLevel;
  status: RiskStatus;
  mitigation: string | null;
  is_visible_to_client: boolean;
  created_at: string;
  updated_at: string;
}

// ── Visitas de obra ──────────────────────────────────────────────────────────

export interface ExpeditionSiteVisit {
  id: string;
  request_id: string;
  visited_at: string;        // ISO date YYYY-MM-DD
  technician: string;
  observations: string | null;
  is_visible_to_client: boolean;
  created_at: string;
  attachments?: ExpeditionAttachment[];
}

// ── Actas ────────────────────────────────────────────────────────────────────

export interface ExpeditionMeetingMinute {
  id: string;
  request_id: string;
  title: string;
  meeting_date: string;     // ISO date YYYY-MM-DD
  attendees: string[] | null;
  summary: string | null;
  action_points: string[] | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  is_visible_to_client: boolean;
  created_at: string;
  signedUrl?: string | null;  // generada en runtime
}

// ── Presupuesto base ─────────────────────────────────────────────────────────

export interface ExpeditionBudget {
  id: string;
  request_id: string;
  initial_budget: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Partidas de coste ────────────────────────────────────────────────────────

export interface ExpeditionCostItem {
  id: string;
  request_id: string;
  budget_id: string | null;
  description: string;
  amount: number;
  category: CostCategory;
  is_approved: boolean;
  date: string | null;       // ISO date YYYY-MM-DD
  created_at: string;
}

// ── Fotos de obra ────────────────────────────────────────────────────────────

export interface ExpeditionPhoto {
  id: string;
  request_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  taken_at: string | null;   // ISO date YYYY-MM-DD
  is_visible_to_client: boolean;
  uploaded_by: string | null;
  uploaded_by_role: "admin" | "client";
  uploaded_at: string;
  // Trazabilidad de origen (0013)
  source_entity_type: "modification" | "site_visit" | null;
  source_entity_id: string | null;
  signedUrl?: string | null;  // generada en runtime
}

export interface ExpeditionAttachment {
  id: string;
  request_id: string;
  entity_type: "decision" | "incident" | "site_visit";
  entity_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_by_role: "admin" | "client";
  created_at: string;
  signedUrl?: string | null;
}
