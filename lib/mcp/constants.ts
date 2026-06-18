// ============================================================
// Constantes del servidor MCP para el Agente IA.
// ============================================================

/**
 * UUID fijo del usuario "Agente IA". Definido en la migración 0027
 * (auth.users + profiles). Todas las acciones del bot vía MCP usan
 * este id como created_by / owner_id para trazabilidad.
 *
 * Si cambias este valor, actualizar también la migración SQL.
 */
export const AGENT_USER_ID = "00000000-0000-0000-0000-000000a1a1a1";

export const AGENT_DISPLAY_NAME = "Agente IA";
