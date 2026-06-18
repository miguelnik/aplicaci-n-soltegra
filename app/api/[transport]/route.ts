import { NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";

import { verifyMcpAuth } from "@/lib/mcp/auth";
import { registerCrmReadTools } from "@/lib/mcp/tools/read-crm";

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
    registerCrmReadTools(server);
    // Próximas fases:
    //   registerCompanyReadTools(server);
    //   registerCrmWriteTools(server);
    //   registerProjectWriteTools(server);  // con dryRun obligatorio
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
  if (!verifyMcpAuth(request)) {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
      { status: 401 },
    );
  }
  return mcpHandler(request);
}

export { authed as GET, authed as POST, authed as DELETE };
