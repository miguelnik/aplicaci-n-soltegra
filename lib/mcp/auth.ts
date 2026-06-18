import "server-only";

/**
 * Verifica el bearer token del servidor MCP.
 *
 * El secreto se comparte con OpenClaw (u otros clientes MCP autorizados).
 * Devuelve true si el header Authorization contiene "Bearer <MCP_AGENT_TOKEN>".
 */
export function verifyMcpAuth(request: Request): boolean {
  const expected = process.env.MCP_AGENT_TOKEN;
  if (!expected) return false;

  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return false;

  const provided = header.slice(7).trim();
  if (!provided) return false;

  // Comparación constant-time para evitar ataques de timing.
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
