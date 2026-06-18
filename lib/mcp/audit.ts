import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AGENT_USER_ID } from "./constants";

export type AuditStatus = "ok" | "error" | "dry_run";

interface LogToolCallInput {
  toolName: string;
  args: Record<string, unknown>;
  status: AuditStatus;
  summary?: string;
  errorMessage?: string;
  durationMs: number;
  requestId?: string;
}

/**
 * Registra una llamada a tool del agente en agent_audit_log.
 *
 * Best-effort: si falla la escritura del log, NO propagamos el error
 * para no romper la tool call principal. Solo se imprime warning.
 */
export async function logToolCall(input: LogToolCallInput): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("agent_audit_log").insert({
      agent_id: AGENT_USER_ID,
      tool_name: input.toolName,
      args: input.args,
      result_status: input.status,
      result_summary: input.summary?.slice(0, 1000) ?? null,
      error_message: input.errorMessage?.slice(0, 1000) ?? null,
      duration_ms: input.durationMs,
      request_id: input.requestId ?? null,
    });
  } catch (err) {
    console.warn("[mcp/audit] failed to log tool call", input.toolName, err);
  }
}

/**
 * Wrapper para ejecutar una tool con logging automático.
 * Devuelve el resultado tal cual (o lanza el error tras loguearlo).
 */
export async function withAudit<T>(
  toolName: string,
  args: Record<string, unknown>,
  fn: () => Promise<{ result: T; summary?: string; status?: AuditStatus }>,
): Promise<T> {
  const start = Date.now();
  try {
    const { result, summary, status } = await fn();
    void logToolCall({
      toolName,
      args,
      status: status ?? "ok",
      summary,
      durationMs: Date.now() - start,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void logToolCall({
      toolName,
      args,
      status: "error",
      errorMessage: message,
      durationMs: Date.now() - start,
    });
    throw err;
  }
}
