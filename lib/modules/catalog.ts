// ============================================================================
// Catálogo de módulos disponibles en el sistema.
// Cada entrada describe un módulo posible para cualquier tipo de servicio.
// ============================================================================

import type { ModuleKey, ModuleVisibility } from "./types";

export interface ModuleMeta {
  key: ModuleKey;
  /** Nombre por defecto (sobreescribible por el admin) */
  defaultLabel: string;
  /** Descripción interna para el admin */
  description: string;
  /** Visibilidad por defecto */
  defaultVisibility: ModuleVisibility;
  /** ¿Está completamente implementado en esta versión? */
  implemented: boolean;
  /** Grupo visual para el editor de módulos */
  group: "core" | "documentation" | "obra";
}

export const MODULE_CATALOG: ModuleMeta[] = [
  // ── Core ──────────────────────────────────────────────────────────────────
  {
    key: "status_timeline",
    defaultLabel: "Estado del expediente",
    description: "Línea de tiempo con los estados por los que ha pasado el expediente.",
    defaultVisibility: "both",
    implemented: true,
    group: "core",
  },
  {
    key: "messages",
    defaultLabel: "Mensajes",
    description: "Hilo de conversación entre el cliente y el equipo de Soltegra.",
    defaultVisibility: "both",
    implemented: true,
    group: "core",
  },
  {
    key: "submitted_data",
    defaultLabel: "Datos enviados",
    description: "Información del formulario inicial rellenado por el cliente.",
    defaultVisibility: "both",
    implemented: true,
    group: "core",
  },
  {
    key: "client_files",
    defaultLabel: "Archivos aportados",
    description: "Archivos adjuntos subidos por el cliente en el formulario inicial.",
    defaultVisibility: "both",
    implemented: true,
    group: "core",
  },
  {
    key: "deliverables",
    defaultLabel: "Entregables",
    description: "Documentos finales entregados al cliente (planos, memorias, certificados...).",
    defaultVisibility: "both",
    implemented: true,
    group: "core",
  },
  {
    key: "documents",
    defaultLabel: "Documentación",
    description: "Documentación adicional del expediente (comunicaciones, informes, anexos...).",
    defaultVisibility: "both",
    implemented: true,
    group: "documentation",
  },
  {
    key: "payment",
    defaultLabel: "Estado de pago",
    description: "Control de cobro del expediente. Visible solo para administración por defecto.",
    defaultVisibility: "admin",
    implemented: true,
    group: "core",
  },
  // ── Gestión de proyecto ───────────────────────────────────────────────────
  {
    key: "milestones",
    defaultLabel: "Hitos del proyecto",
    description: "Hitos y entregables programados del proyecto con fecha y estado.",
    defaultVisibility: "both",
    implemented: true,
    group: "documentation",
  },
  {
    key: "pending_decisions",
    defaultLabel: "Modificaciones",
    description: "Solicitudes de cambio del proyecto. Tanto el cliente como el equipo pueden crearlas y deben ser aprobadas por la otra parte.",
    defaultVisibility: "both",
    implemented: true,
    group: "documentation",
  },
  {
    key: "incidents",
    defaultLabel: "Incidencias",
    description: "Registro de incidencias o problemas detectados durante el proyecto.",
    defaultVisibility: "admin",
    implemented: true,
    group: "documentation",
  },
  {
    key: "risks",
    defaultLabel: "Riesgos",
    description: "Mapa de riesgos identificados. Las entradas no publicadas son solo internas.",
    defaultVisibility: "admin",
    implemented: true,
    group: "documentation",
  },
  // ── Dirección de obra ─────────────────────────────────────────────────────
  {
    key: "construction_dashboard",
    defaultLabel: "Cuadro de mando de obra",
    description: "Dashboard de avance de obra: plazo, coste, hitos y alertas.",
    defaultVisibility: "both",
    implemented: true,
    group: "obra",
  },
  {
    key: "site_visits",
    defaultLabel: "Visitas de obra",
    description: "Registro de visitas realizadas a la obra con fecha, técnico y observaciones.",
    defaultVisibility: "both",
    implemented: true,
    group: "obra",
  },
  {
    key: "site_photos",
    defaultLabel: "Fotos de obra",
    description: "Galería fotográfica del avance de obra organizada por fecha o fase.",
    defaultVisibility: "both",
    implemented: true,
    group: "obra",
  },
  {
    key: "meeting_minutes",
    defaultLabel: "Actas",
    description: "Actas de reuniones, visitas de obra y reuniones de coordinación.",
    defaultVisibility: "both",
    implemented: true,
    group: "obra",
  },
  {
    key: "economic_summary",
    defaultLabel: "Resumen económico",
    description: "Seguimiento de presupuesto, costes y variaciones de la obra.",
    defaultVisibility: "admin",
    implemented: true,
    group: "obra",
  },
];

/** Mapa rápido key → meta */
export const MODULE_CATALOG_MAP = new Map<ModuleKey, ModuleMeta>(
  MODULE_CATALOG.map((m) => [m.key, m]),
);

export const GROUP_LABELS: Record<string, string> = {
  core: "Núcleo",
  documentation: "Gestión de proyecto",
  obra: "Dirección de obra",
};
