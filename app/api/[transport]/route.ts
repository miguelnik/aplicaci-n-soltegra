import { NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";

import { verifyMcpAuth } from "@/lib/mcp/auth";
import { registerCrmReadTools } from "@/lib/mcp/tools/read-crm";
import { registerCompanyReadTools } from "@/lib/mcp/tools/read-company";
import { registerMetricsTools } from "@/lib/mcp/tools/read-metrics";
import { registerCrmWriteTools } from "@/lib/mcp/tools/write-crm";
import { registerProjectWriteTools } from "@/lib/mcp/tools/write-projects";

// ─────────────────────────────────────────────────────────────────────────────
// Servidor MCP del CRM Soltegra.
//
// URL pública: https://proyectos.soltegra.es/api/mcp
// Auth: Authorization: Bearer <MCP_AGENT_TOKEN>
//
// Las tools están registradas por dominio en lib/mcp/tools/*.ts y
// se enganchan aquí. Cada tool envuelve su lógica con withAudit() para
// dejar traza en agent_audit_log.
// ─────────────────────────────────────────────────────────────────────────────

// El runtime debe ser Node.js (no Edge) porque las tools usan el cliente
// admin de Supabase y el SDK de MCP requiere APIs Node.
export const runtime = "nodejs";

// Vercel: dar margen para tools que toquen BD bajo carga.
export const maxDuration = 60;

const mcpHandler = createMcpHandler(
  (server) => {
    // Lectura
    registerCrmReadTools(server);       // list/get opportunities, contacts
    registerCompanyReadTools(server);   // orgs, projects, tasks, services, admins
    registerMetricsTools(server);       // crm_metrics, company_dashboard
    // Escritura (idempotentes y reversibles)
    registerCrmWriteTools(server);      // update_stage, add_interaction, create_*…
    // Escritura crítica con dryRun (doble paso)
    registerProjectWriteTools(server);  // convert→project, phase, paid, message
  },
  {
    // capabilities (logging, etc.) — vacío de momento.
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
  },
);

async function authed(request: Request): Promise<Response> {
  const auth = verifyMcpAuth(request);
  if (!auth.ok) {
    // server_misconfigured → 500 (no es culpa del cliente).
    // missing_header / invalid_token → 401.
    const status = auth.reason === "server_misconfigured" ? 500 : 401;
    const message =
      auth.reason === "server_misconfigured"
        ? "Server misconfigured"
        : "Unauthorized";
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message,
          // Detalle no sensible — ayuda a diagnosticar 401s sin filtrar el token.
          data: { reason: auth.reason, detail: auth.detail },
        },
        id: null,
      },
      { status },
    );
  }
  return mcpHandler(request);
}

export { authed as GET, authed as POST, authed as DELETE };
