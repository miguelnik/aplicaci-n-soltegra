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
 * que NO son certificado energético. Cubre los módulos esenciales.
 */
export const GENERIC_SERVICE_DEFAULT: ServiceModuleConfig = [
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
];

/**
 * Devuelve la configuración de módulos efectiva para un tipo de servicio.
 * Prioridad:
 *   1. module_config configurado por el admin en la BD (si existe y tiene items)
 *   2. Fallback por slug (certificado-energetico → experiencia actual exacta)
 *   3. Fallback genérico (para cualquier otro servicio nuevo)
 *
 * El resultado siempre viene ordenado por `order` ASC.
 */
export function getEffectiveModules(
  serviceSlug: string,
  moduleConfig: ServiceModuleConfig | null | undefined,
): ServiceModuleConfig {
  if (moduleConfig && moduleConfig.length > 0) {
    return [...moduleConfig].sort((a, b) => a.order - b.order);
  }
  if (serviceSlug === "certificado-energetico") {
    return CERTIFICADO_ENERGETICO_DEFAULT;
  }
  return GENERIC_SERVICE_DEFAULT;
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
