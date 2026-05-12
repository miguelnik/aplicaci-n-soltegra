// ============================================================================
// Configuraciones por defecto de módulos para tipos de servicio.
// Si un servicio no tiene module_config en la BD, se usa el fallback aquí.
// Los certificados energéticos tienen su propio default que reproduce
// exactamente la experiencia actual (compatibilidad 100% garantizada).
// ============================================================================

import type { ServiceModuleConfig } from "./types";

/**
 * Configuración por defecto para el servicio "certificado-energetico".
 * Reproduce exactamente la vista actual: ningún cliente nota el cambio.
 */
export const CERTIFICADO_ENERGETICO_DEFAULT: ServiceModuleConfig = [
  // Orden idéntico a la página original: mensajes → estado → datos → archivos → entregable
  {
    key: "messages",
    label: "Conversación con Soltegra",
    is_active: true,
    visible_to: "both",
    order: 0,
  },
  {
    key: "status_timeline",
    label: "Estado",
    is_active: true,
    visible_to: "both",
    order: 1,
  },
  {
    key: "submitted_data",
    label: "Información enviada",
    is_active: true,
    visible_to: "both",
    order: 2,
  },
  {
    key: "client_files",
    label: "Archivos adjuntos",
    is_active: true,
    visible_to: "both",
    order: 3,
  },
  {
    key: "deliverables",
    label: "Certificado energético",
    is_active: true,
    visible_to: "both",
    order: 4,
  },
  {
    key: "payment",
    label: "Estado de pago",
    is_active: true,
    visible_to: "admin",   // El admin lo ve; el cliente no
    order: 5,
  },
];

/**
 * Configuración fallback genérica para servicios sin module_config
 * que NO son certificado energético. Incluye todos los módulos disponibles.
 * Los módulos de obra están activos pero ocultos al cliente por defecto,
 * para que el admin los active cuando corresponda.
 */
export const GENERIC_SERVICE_DEFAULT: ServiceModuleConfig = [
  // ── Núcleo ────────────────────────────────────────────────────────────────
  {
    key: "status_timeline",
    label: "Estado",
    is_active: true,
    visible_to: "both",
    order: 0,
  },
  {
    key: "messages",
    label: "Mensajes",
    is_active: true,
    visible_to: "both",
    order: 1,
  },
  {
    key: "submitted_data",
    label: "Información enviada",
    is_active: true,
    visible_to: "both",
    order: 2,
  },
  {
    key: "client_files",
    label: "Archivos adjuntos",
    is_active: true,
    visible_to: "both",
    order: 3,
  },
  {
    key: "deliverables",
    label: "Entregables",
    is_active: true,
    visible_to: "both",
    order: 4,
  },
  {
    key: "documents",
    label: "Documentación",
    is_active: true,
    visible_to: "both",
    order: 5,
  },
  {
    key: "payment",
    label: "Estado de pago",
    is_active: true,
    visible_to: "admin",
    order: 6,
  },
  // ── Gestión de proyecto ───────────────────────────────────────────────────
  {
    key: "milestones",
    label: "Hitos del proyecto",
    is_active: true,
    visible_to: "both",
    order: 7,
  },
  {
    key: "pending_decisions",
    label: "Decisiones pendientes",
    is_active: true,
    visible_to: "both",
    order: 8,
  },
  {
    key: "incidents",
    label: "Incidencias",
    is_active: true,
    visible_to: "admin",   // oculto al cliente por defecto
    order: 9,
  },
  {
    key: "risks",
    label: "Riesgos",
    is_active: true,
    visible_to: "admin",   // oculto al cliente por defecto
    order: 10,
  },
  // ── Dirección de obra ─────────────────────────────────────────────────────
  {
    key: "construction_dashboard",
    label: "Cuadro de mando",
    is_active: true,
    visible_to: "both",
    order: 11,
  },
  {
    key: "site_visits",
    label: "Visitas de obra",
    is_active: true,
    visible_to: "both",
    order: 12,
  },
  {
    key: "site_photos",
    label: "Fotos de obra",
    is_active: true,
    visible_to: "both",
    order: 13,
  },
  {
    key: "meeting_minutes",
    label: "Actas",
    is_active: true,
    visible_to: "both",
    order: 14,
  },
  {
    key: "economic_summary",
    label: "Resumen económico",
    is_active: true,
    visible_to: "admin",   // oculto al cliente por defecto
    order: 15,
  },
];

/**
 * Devuelve la configuración de módulos efectiva para un tipo de servicio.
 *
 * Estrategia de merge:
 *   - Si no hay config guardada en BD: usa el default completo (base).
 *   - Si hay config guardada: los módulos guardados se respetan tal cual
 *     (el admin los configuró así intencionadamente), PERO los módulos que
 *     existan en el default y NO en la config guardada se añaden con los
 *     valores por defecto. Esto garantiza que los módulos nuevos del catálogo
 *     aparecen siempre, incluso en servicios con configuración de versiones
 *     anteriores del sistema.
 *
 * El resultado siempre viene ordenado por `order` ASC.
 */
export function getEffectiveModules(
  serviceSlug: string,
  moduleConfig: ServiceModuleConfig | null | undefined,
): ServiceModuleConfig {
  // Base de módulos disponibles para este tipo de servicio
  const base =
    serviceSlug === "certificado-energetico"
      ? CERTIFICADO_ENERGETICO_DEFAULT
      : GENERIC_SERVICE_DEFAULT;

  // Sin config guardada → usar el base directamente
  if (!moduleConfig || moduleConfig.length === 0) {
    return [...base].sort((a, b) => a.order - b.order);
  }

  // Config guardada existe → merge:
  // Empezamos con los módulos guardados (respetan configuración del admin)
  // y añadimos cualquier módulo del base que no esté en la lista guardada.
  const savedKeys = new Set(moduleConfig.map((m) => m.key));
  const result: ServiceModuleConfig = [...moduleConfig];

  for (const baseMod of base) {
    if (!savedKeys.has(baseMod.key)) {
      result.push(baseMod);
    }
  }

  return result.sort((a, b) => a.order - b.order);
}

/**
 * Filtra los módulos visibles para un rol dado.
 * Un módulo visible_to="admin" nunca se muestra al cliente.
 */
export function filterModulesForRole(
  modules: ServiceModuleConfig,
  role: "client" | "admin",
): ServiceModuleConfig {
  return modules.filter((m) => {
    if (!m.is_active) return false;
    if (role === "client") return m.visible_to === "client" || m.visible_to === "both";
    return true; // admin ve todos los activos
  });
}
