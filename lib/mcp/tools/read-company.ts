import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withAudit } from "../audit";

// ─────────────────────────────────────────────────────────────────────────────
// Tools de LECTURA del resto de la empresa: organizaciones (clientes),
// proyectos (certificate_requests), tareas (user_tasks) y servicios.
// ─────────────────────────────────────────────────────────────────────────────

const RequestStatusEnum = z.enum([
  "draft",
  "submitted",
  "in_review",
  "in_progress",
  "awaiting_info",
  "delivered",
  "cancelled",
]);

const TaskStatusEnum = z.enum(["pending", "done", "dismissed"]);

export function registerCompanyReadTools(server: McpServer): void {
  // ── Organizaciones (clientes) ──────────────────────────────────────────────
  server.registerTool(
    "list_organizations",
    {
      title: "Listar organizaciones (clientes)",
      description:
        "Lista las organizaciones cliente de Soltegra (promotoras, inmobiliarias, particulares).",
      inputSchema: {
        search: z.string().max(100).optional().describe(
          "Búsqueda libre en nombre o CIF.",
        ),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ search, limit }) => {
      return withAudit("list_organizations", { search, limit }, async () => {
        const admin = createSupabaseAdminClient();
        let query = admin
          .from("organizations")
          .select("id, name, cif, contact_email, contact_phone, created_at")
          .order("name", { ascending: true })
          .limit(limit);

        if (search) {
          query = query.or(`name.ilike.%${search}%,cif.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) throw new Error(`DB error: ${error.message}`);

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { count: data?.length ?? 0, organizations: data ?? [] },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `${data?.length ?? 0} organizaciones`,
        };
      });
    },
  );

  server.registerTool(
    "get_organization",
    {
      title: "Detalle de organización (cliente)",
      description:
        "Detalle de una organización con sus proyectos (certificate_requests), facturación total, y miembros.",
      inputSchema: {
        id: z.string().uuid().describe("UUID de la organización."),
      },
    },
    async ({ id }) => {
      return withAudit("get_organization", { id }, async () => {
        const admin = createSupabaseAdminClient();

        const { data: org, error } = await admin
          .from("organizations")
          .select("id, name, cif, contact_email, contact_phone, notes, created_at")
          .eq("id", id)
          .maybeSingle();

        if (error) throw new Error(`DB error: ${error.message}`);
        if (!org) throw new Error(`Organización ${id} no encontrada.`);

        const { data: projects } = await admin
          .from("certificate_requests")
          .select(
            `id, reference_code, property_address, status, price, is_paid,
             current_phase_key, estimated_delivery_date, delivered_at, created_at,
             service:service_types(slug, name)`,
          )
          .eq("organization_id", id)
          .eq("is_general_overhead", false)
          .order("created_at", { ascending: false })
          .limit(50);

        const { data: members } = await admin
          .from("profiles")
          .select("id, full_name, role, phone")
          .eq("organization_id", id);

        const totalBilled = (projects ?? [])
          .filter((p) => p.is_paid)
          .reduce((sum, p) => sum + Number(p.price ?? 0), 0);
        const pendingBilling = (projects ?? [])
          .filter((p) => !p.is_paid && p.price != null)
          .reduce((sum, p) => sum + Number(p.price ?? 0), 0);

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    organization: org,
                    projects: projects ?? [],
                    members: members ?? [],
                    finance: {
                      totalBilled,
                      pendingBilling,
                      projectsCount: projects?.length ?? 0,
                    },
                  },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `Org ${org.name}: ${projects?.length ?? 0} proyectos, ${totalBilled}€ facturados`,
        };
      });
    },
  );

  // ── Proyectos (certificate_requests) ───────────────────────────────────────
  server.registerTool(
    "list_projects",
    {
      title: "Listar proyectos",
      description:
        "Lista proyectos (certificate_requests) con filtros opcionales por status, organización, paid, etc.",
      inputSchema: {
        status: RequestStatusEnum.optional().describe(
          "Filtrar por estado del proyecto.",
        ),
        organizationId: z.string().uuid().optional(),
        isPaid: z.boolean().optional().describe(
          "Filtrar por estado de pago.",
        ),
        assignedTo: z.string().uuid().optional().describe(
          "Filtrar por trabajador asignado.",
        ),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ status, organizationId, isPaid, assignedTo, limit }) => {
      return withAudit(
        "list_projects",
        { status, organizationId, isPaid, assignedTo, limit },
        async () => {
          const admin = createSupabaseAdminClient();
          let query = admin
            .from("certificate_requests")
            .select(
              `id, reference_code, property_address, status, price, is_paid,
               current_phase_key, estimated_delivery_date, delivered_at,
               assigned_to, organization_id, service_type_id, created_at,
               organization:organizations(name),
               service:service_types(slug, name)`,
            )
            .eq("is_general_overhead", false)
            .order("created_at", { ascending: false })
            .limit(limit);

          if (status) query = query.eq("status", status);
          if (organizationId) query = query.eq("organization_id", organizationId);
          if (isPaid !== undefined) query = query.eq("is_paid", isPaid);
          if (assignedTo) query = query.eq("assigned_to", assignedTo);

          const { data, error } = await query;
          if (error) throw new Error(`DB error: ${error.message}`);

          return {
            result: {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    { count: data?.length ?? 0, projects: data ?? [] },
                    null,
                    2,
                  ),
                },
              ],
            },
            summary: `${data?.length ?? 0} proyectos${status ? ` (${status})` : ""}`,
          };
        },
      );
    },
  );

  server.registerTool(
    "get_project",
    {
      title: "Detalle de proyecto",
      description:
        "Detalle completo de un proyecto: datos, historial de estados, mensajes recientes con el cliente, horas imputadas totales.",
      inputSchema: {
        id: z.string().uuid().describe("UUID del proyecto (certificate_request)."),
      },
    },
    async ({ id }) => {
      return withAudit("get_project", { id }, async () => {
        const admin = createSupabaseAdminClient();

        const { data: project, error } = await admin
          .from("certificate_requests")
          .select(
            `id, reference_code, property_address, status, price, is_paid, paid_at,
             current_phase_key, status_history, estimated_delivery_date, delivered_at,
             client_deadline, internal_notes, assigned_to,
             form_data, is_hidden_from_client, created_at, updated_at,
             organization:organizations(id, name, contact_email, contact_phone),
             service:service_types(id, slug, name)`,
          )
          .eq("id", id)
          .maybeSingle();

        if (error) throw new Error(`DB error: ${error.message}`);
        if (!project) throw new Error(`Proyecto ${id} no encontrado.`);

        const { data: messages } = await admin
          .from("request_messages")
          .select("id, author_role, body, created_at")
          .eq("request_id", id)
          .order("created_at", { ascending: false })
          .limit(10);

        const { data: hours } = await admin
          .from("time_entries")
          .select("hours")
          .eq("request_id", id);
        const totalHours = (hours ?? []).reduce(
          (sum, h) => sum + Number(h.hours),
          0,
        );

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    project,
                    recentMessages: messages ?? [],
                    totalHoursLogged: totalHours,
                  },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `Proyecto ${project.reference_code ?? id} status=${project.status}`,
        };
      });
    },
  );

  // ── Tareas pendientes ──────────────────────────────────────────────────────
  server.registerTool(
    "list_tasks",
    {
      title: "Listar tareas pendientes",
      description:
        "Lista tareas del equipo. Por defecto muestra las pendientes ordenadas por fecha límite.",
      inputSchema: {
        status: TaskStatusEnum.optional().default("pending"),
        assigneeId: z.string().uuid().optional().describe(
          "Filtrar por usuario asignado.",
        ),
        opportunityId: z.string().uuid().optional(),
        requestId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      },
    },
    async ({ status, assigneeId, opportunityId, requestId, limit }) => {
      return withAudit(
        "list_tasks",
        { status, assigneeId, opportunityId, requestId, limit },
        async () => {
          const admin = createSupabaseAdminClient();
          let query = admin
            .from("user_tasks")
            .select(
              `id, title, description, status, priority, due_at,
               assignee_id, created_by, opportunity_id, contact_id,
               request_id, completed_at, created_at,
               assignee:profiles!user_tasks_assignee_id_fkey(full_name)`,
            )
            .order("due_at", { ascending: true, nullsFirst: false })
            .limit(limit);

          if (status) query = query.eq("status", status);
          if (assigneeId) query = query.eq("assignee_id", assigneeId);
          if (opportunityId) query = query.eq("opportunity_id", opportunityId);
          if (requestId) query = query.eq("request_id", requestId);

          const { data, error } = await query;
          if (error) throw new Error(`DB error: ${error.message}`);

          return {
            result: {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    { count: data?.length ?? 0, tasks: data ?? [] },
                    null,
                    2,
                  ),
                },
              ],
            },
            summary: `${data?.length ?? 0} tareas`,
          };
        },
      );
    },
  );

  // ── Servicios (catálogo) ───────────────────────────────────────────────────
  server.registerTool(
    "list_service_types",
    {
      title: "Listar tipos de servicio",
      description:
        "Catálogo de servicios que ofrece Soltegra. Útil para que el agente sepa qué service_type_id pasar al crear oportunidades o convertir a proyecto.",
      inputSchema: {
        onlyActive: z.boolean().default(true),
      },
    },
    async ({ onlyActive }) => {
      return withAudit("list_service_types", { onlyActive }, async () => {
        const admin = createSupabaseAdminClient();
        let query = admin
          .from("service_types")
          .select("id, slug, name, description, display_order, is_active")
          .order("display_order", { ascending: true });
        if (onlyActive) query = query.eq("is_active", true);

        const { data, error } = await query;
        if (error) throw new Error(`DB error: ${error.message}`);

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { count: data?.length ?? 0, services: data ?? [] },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `${data?.length ?? 0} servicios`,
        };
      });
    },
  );

  // ── Lista admins (para asignaciones) ──────────────────────────────────────
  server.registerTool(
    "list_admins",
    {
      title: "Listar usuarios admin",
      description:
        "Lista los usuarios admin de Soltegra. Útil para resolver nombres a owner_id al asignar oportunidades o tareas.",
      inputSchema: {},
    },
    async () => {
      return withAudit("list_admins", {}, async () => {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin
          .from("profiles")
          .select("id, full_name, phone")
          .eq("role", "admin")
          .order("full_name");

        if (error) throw new Error(`DB error: ${error.message}`);

        return {
          result: {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { count: data?.length ?? 0, admins: data ?? [] },
                  null,
                  2,
                ),
              },
            ],
          },
          summary: `${data?.length ?? 0} admins`,
        };
      });
    },
  );
}
