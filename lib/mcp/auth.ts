import "server-only";

/**
 * Resultado de verificar el bearer token del servidor MCP.
 * Distingue los modos de fallo para que el cliente entienda si el problema
 * es de configuración del servidor o de su petición.
 */
export type McpAuthResult =
  | { ok: true }
  | { ok: false; reason: "server_misconfigured"; detail: string }
  | { ok: false; reason: "missing_header"; detail: string }
  | { ok: false; reason: "invalid_token"; detail: string };

/**
 * Verifica el bearer token del servidor MCP.
 *
 * El secreto se comparte con OpenClaw (u otros clientes MCP autorizados).
 * El header esperado es: Authorization: Bearer <MCP_AGENT_TOKEN>
 */
export function verifyMcpAuth(request: Request): McpAuthResult {
  const expectedRaw = process.env.MCP_AGENT_TOKEN;
  if (!expectedRaw) {
    return {
      ok: false,
      reason: "server_misconfigured",
      detail: "MCP_AGENT_TOKEN no está configurada en el servidor.",
    };
  }
  const expected = expectedRaw.trim();
  if (!expected) {
    return {
      ok: false,
      reason: "server_misconfigured",
      detail: "MCP_AGENT_TOKEN está vacía en el servidor.",
    };
  }

  const header = request.headers.get("authorization") || "";
  if (!header) {
    return {
      ok: false,
      reason: "missing_header",
      detail: "Falta el header Authorization.",
    };
  }
  if (!header.startsWith("Bearer ")) {
    return {
      ok: false,
      reason: "missing_header",
      detail: 'El header Authorization debe empezar por "Bearer ".',
    };
  }

  const provided = header.slice(7).trim();
  if (!provided) {
    return {
      ok: false,
      reason: "missing_header",
      detail: "Bearer sin token tras la palabra Bearer.",
    };
  }

  // Comparación constant-time para evitar ataques de timing.
  if (provided.length !== expected.length) {
    return {
      ok: false,
      reason: "invalid_token",
      detail: `Longitud del token recibida (${provided.length}) distinta de la esperada (${expected.length}).`,
    };
  }
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) {
    return {
      ok: false,
      reason: "invalid_token",
      detail: "Token no coincide con el configurado en el servidor.",
    };
  }
  return { ok: true };
}
