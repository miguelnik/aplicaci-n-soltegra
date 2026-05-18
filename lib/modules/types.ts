// ============================================================================
// Sistema de módulos configurables por tipo de servicio.
// Un módulo es una sección del portal del cliente que puede activarse,
// desactivarse, reordenarse y configurar su visibilidad por servicio.
// ============================================================================

/**
 * Identificadores de módulo. Cada valor mapea a un componente React.
 * Los módulos no implementados se renderizan como "próximamente" (solo admin).
 */
export type ModuleKey =
  // ── Implementados en Fase 1 ──────────────────────────────────────────────
  | "status_timeline"      // Timeline de estados del expediente
  | "messages"             // Hilo de mensajes admin ↔ cliente
  | "submitted_data"       // Datos del formulario inicial del cliente
  | "client_files"         // Archivos subidos por el cliente en el formulario
  | "deliverables"         // Entregables finales (incl. certificado PDF legacy)
  | "documents"            // Documentación genérica del expediente
  | "payment"              // Estado de pago (admin por defecto)
  // ── Preparados / futuros ─────────────────────────────────────────────────
  | "milestones"           // Hitos del proyecto
  | "pending_decisions"    // Decisiones pendientes del cliente
  | "incidents"            // Registro de incidencias
  | "risks"                // Mapa de riesgos
  | "construction_dashboard" // Cuadro de mando de dirección de obra
  | "site_visits"          // Visitas de obra
  | "site_photos"          // Galería de fotos de obra
  | "meeting_minutes"      // Actas de reunión / visita de obra
  | "economic_summary";    // Resumen económico / control de costes

/** Quién puede ver el módulo en el portal */
export type ModuleVisibility = "client" | "admin" | "both";

/**
 * Configuración de un módulo dentro de un tipo de servicio.
 * Se almacena como array JSONB en service_types.module_config.
 */
export interface ModuleConfig {
  /** Identificador del módulo (del catálogo) */
  key: ModuleKey;
  /** Nombre visible en el portal del cliente / admin */
  label: string;
  /** ¿Está activo para este servicio? */
  is_active: boolean;
  /** ¿Quién lo ve? */
  visible_to: ModuleVisibility;
  /** Posición en pantalla (menor = antes). */
  order: number;
  /** Descripción interna (solo para referencia del admin) */
  description?: string;
  /** Configuración adicional específica del módulo (para futuro uso) */
  config?: Record<string, unknown>;
}

/** La configuración completa de módulos de un tipo de servicio */
export type ServiceModuleConfig = ModuleConfig[];

// ──────────────────────────────────────────────────────────────────────────────
// Tipos de datos que los componentes de módulo reciben como props
// ──────────────────────────────────────────────────────────────────────────────

export interface FileWithUrl {
  id: string;
  field_key: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  signedUrl: string | null;
}

export interface ExpeditionDocument {
  id: string;
  request_id: string;
  category: "deliverable" | "admin_document" | "client_document";
  label: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  is_visible_to_client: boolean;
  uploaded_at: string;
  internal_notes: string | null;
  signedUrl?: string | null;
}

/**
 * Todos los datos que una página de expediente pre-fetcha y pasa
 * a los componentes de módulo. Evita waterfall: un fetch, todo disponible.
 */
export interface ModulePageData {
  // Solicitud completa (certificate_requests row)
  req: {
    id: string;
    status: string;
    status_history: Array<{ status: string; at: string }>;
    property_address: string | null;
    reference_code: string | null;
    estimated_delivery_date: string | null;
    delivered_at: string | null;
    certificate_pdf_path: string | null;
    form_data: Record<string, unknown>;
    is_paid: boolean;
    paid_at: string | null;
    /** Precio acordado del servicio (en EUR) — sólo visible al admin */
    price: number | null;
    /** Si es true, el cliente nunca ve este expediente */
    is_hidden_from_client: boolean;
    internal_notes: string | null;
    client_notes: string | null;
    client_deadline: string | null;
    organization_id: string;
    created_at: string;
    /** Fase actual del proyecto (clave de la fase activa en status_phases del servicio) */
    current_phase_key: string | null;
    /** UUID del trabajador asignado a la solicitud */
    assigned_to: string | null;
  };
  /** Fases configuradas en el servicio (de service_types.status_phases) */
  statusPhases: Array<{ key: string; label: string; description?: string }>;
  // Schema del formulario inicial (de form_schemas)
  schema: import("@/lib/form-schema/types").FormSchema | null;
  // Archivos del cliente con URLs firmadas
  filesWithUrls: FileWithUrl[];
  // Mensajes del hilo
  messages: import("@/components/messages/MessageThread").ThreadMessage[];
  // Documentos del expediente (expedition_documents)
  expeditionDocuments: ExpeditionDocument[];

  // ── Módulos de gestión de proyecto y dirección de obra ────────────────────
  milestones: import("@/lib/modules/expedition-types").ExpeditionMilestone[];
  decisions: import("@/lib/modules/expedition-types").ExpeditionDecision[];
  modificationMessages: import("@/lib/modules/expedition-types").ModificationMessage[];
  incidents: import("@/lib/modules/expedition-types").ExpeditionIncident[];
  risks: import("@/lib/modules/expedition-types").ExpeditionRisk[];
  siteVisits: import("@/lib/modules/expedition-types").ExpeditionSiteVisit[];
  meetingMinutes: import("@/lib/modules/expedition-types").ExpeditionMeetingMinute[];
  photos: import("@/lib/modules/expedition-types").ExpeditionPhoto[];
  budget: import("@/lib/modules/expedition-types").ExpeditionBudget | null;
  costItems: import("@/lib/modules/expedition-types").ExpeditionCostItem[];
  attachments: import("@/lib/modules/expedition-types").ExpeditionAttachment[];
}
