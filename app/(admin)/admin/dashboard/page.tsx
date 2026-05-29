import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import { format } from "date-fns";
import { MessageSquare, ListChecks, ArrowRight } from "lucide-react";
import { loadPendingFor } from "@/lib/tasks/dashboard";
import { TaskItem } from "@/components/admin/TaskItem";
import { TaskNotifier } from "@/components/admin/TaskNotifier";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const me = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  // ── Tareas pendientes (mías + recordatorios) ───────────────────────────
  const pendingItems = await loadPendingFor(me.id, false);
  const overdue = pendingItems.filter((p) => p.due_at && new Date(p.due_at).getTime() < Date.now());
  const today = pendingItems.filter((p) => {
    if (!p.due_at) return false;
    const d = new Date(p.due_at);
    const nowD = new Date();
    return d.getFullYear() === nowD.getFullYear() && d.getMonth() === nowD.getMonth() && d.getDate() === nowD.getDate() && d.getTime() >= Date.now();
  });
  const upcoming = pendingItems.slice(0, 8);

  // Contadores por estado
  const { data: counts } = await supabase
    .from("certificate_requests")
    .select("status")
    .not("status", "in", '("draft","cancelled")');

  const submitted = counts?.filter((r) => r.status === "submitted").length ?? 0;
  const inReview = counts?.filter((r) => r.status === "in_review").length ?? 0;
  const inProgress = counts?.filter((r) => r.status === "in_progress").length ?? 0;
  const delivered = counts?.filter((r) => r.status === "delivered").length ?? 0;

  // Solicitudes donde el último mensaje es del cliente (admin debe responder)
  const { data: msgRows } = await supabase
    .from("request_messages")
    .select("request_id, author_role, created_at")
    .order("created_at", { ascending: false });

  // Por cada solicitud, tomar el mensaje más reciente y ver si es del cliente
  const latestByRequest = new Map<string, string>();
  for (const m of msgRows ?? []) {
    if (!latestByRequest.has(m.request_id)) {
      latestByRequest.set(m.request_id, m.author_role);
    }
  }
  const requestsWithClientMessages = new Set(
    Array.from(latestByRequest.entries())
      .filter(([, role]) => role === "client")
      .map(([id]) => id),
  );

  // Solicitudes recientes
  const { data: recent } = await supabase
    .from("certificate_requests")
    .select(`
      id, status, property_address, reference_code, created_at, estimated_delivery_date,
      organizations(name)
    `)
    .not("status", "in", '("draft","cancelled")')
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-6">
      {/* Toast popup para tareas de hoy/vencidas */}
      <TaskNotifier items={pendingItems} />

      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Widget de tareas pendientes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-primary" />
              Tareas pendientes
              {overdue.length > 0 && (
                <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  {overdue.length} vencida{overdue.length > 1 ? "s" : ""}
                </span>
              )}
              {today.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  {today.length} hoy
                </span>
              )}
            </CardTitle>
            <Link href="/admin/tareas" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">¡Sin tareas pendientes! 🎉</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((item) => (
                <TaskItem
                  key={`${item.source}-${item.id}`}
                  item={item}
                  canDelete={false}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Nuevas", value: submitted, color: "text-blue-600", href: "/admin/solicitudes?status=submitted" },
          { label: "En revisión", value: inReview, color: "text-yellow-600", href: "/admin/solicitudes?status=in_review" },
          { label: "En redacción", value: inProgress, color: "text-orange-600", href: "/admin/solicitudes?status=in_progress" },
          { label: "Entregados", value: delivered, color: "text-green-600", href: "/admin/solicitudes?status=delivered" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Banner de mensajes de clientes pendientes */}
      {requestsWithClientMessages.size > 0 && (
        <Link href="/admin/solicitudes" className="block">
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 hover:bg-blue-100 transition-colors">
            <MessageSquare className="h-5 w-5 shrink-0 text-blue-600" />
            <span>
              <strong>{requestsWithClientMessages.size}</strong>{" "}
              {requestsWithClientMessages.size === 1
                ? "solicitud tiene mensajes del cliente"
                : "solicitudes tienen mensajes de clientes"}
              . Haz clic para revisar.
            </span>
          </div>
        </Link>
      )}

      {/* Proyectos recientes */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Proyectos recientes</h2>
        {recent && recent.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Referencia</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Dirección</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/solicitudes/${req.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {req.reference_code ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(req.organizations as unknown as { name: string } | null)?.name ?? "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3">
                      {req.property_address ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(req.created_at), "dd/MM/yy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin solicitudes todavía.</p>
        )}
      </div>
    </div>
  );
}
