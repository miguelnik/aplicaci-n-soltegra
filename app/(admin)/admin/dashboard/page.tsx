import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

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
      <h1 className="text-2xl font-bold">Dashboard</h1>

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

      {/* Solicitudes recientes */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Solicitudes recientes</h2>
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
