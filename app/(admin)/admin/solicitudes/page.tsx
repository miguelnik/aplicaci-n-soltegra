import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveServices } from "@/lib/services";
import { StatusBadge } from "@/components/client/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  MessageSquare,
  Plus,
  Search,
  UserRoundX,
} from "lucide-react";

const STATUSES = [
  { value: "", label: "Todas" },
  { value: "submitted", label: "Nuevas" },
  { value: "in_review", label: "En revisión" },
  { value: "in_progress", label: "En redacción" },
  { value: "awaiting_info", label: "Pend. info" },
  { value: "delivered", label: "Entregadas" },
  { value: "cancelled", label: "Canceladas" },
];

interface Props {
  searchParams: Promise<{ status?: string; service?: string; q?: string }>;
}

export default async function AdminSolicitudesPage({ searchParams }: Props) {
  await requireAdmin();
  const { status, service: serviceSlug, q: rawSearch } = await searchParams;
  const adminClient = createSupabaseAdminClient();
  const search = rawSearch?.trim() ?? "";

  const services = await getActiveServices();
  const selectedService = serviceSlug ? services.find((s) => s.slug === serviceSlug) : null;

  // Usar admin client para bypasear RLS y que el superadmin vea todas las solicitudes
  let query = adminClient
    .from("certificate_requests")
    .select(`id, reference_code, property_address, status, created_at, estimated_delivery_date, client_deadline, is_paid, organizations(name), service_types(name), assigned:assigned_to(full_name)`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);
  if (selectedService) query = query.eq("service_type_id", selectedService.id);
  if (search) {
    const safeSearch = search.replaceAll(",", " ").replaceAll("%", " ").trim();
    query = query.or(`property_address.ilike.%${safeSearch}%,reference_code.ilike.%${safeSearch}%`);
  }

  const { data: requests } = await query;
  const rows = requests ?? [];

  // IDs donde el último mensaje es del cliente (admin pendiente de responder)
  const requestIds = rows.map((r) => r.id);
  let clientMessageIds = new Set<string>();
  if (requestIds.length > 0) {
    const { data: msgs } = await adminClient
      .from("request_messages")
      .select("request_id, author_role, created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: false });

    const latestByRequest = new Map<string, string>();
    for (const m of msgs ?? []) {
      if (!latestByRequest.has(m.request_id)) {
        latestByRequest.set(m.request_id, m.author_role);
      }
    }
    clientMessageIds = new Set(
      Array.from(latestByRequest.entries())
        .filter(([, role]) => role === "client")
        .map(([id]) => id),
    );
  }

  function buildHref(part: { status?: string; service?: string }): string {
    const params = new URLSearchParams();
    const finalStatus = part.status !== undefined ? part.status : status;
    const finalService = part.service !== undefined ? part.service : serviceSlug;
    if (finalStatus) params.set("status", finalStatus);
    if (finalService) params.set("service", finalService);
    if (search) params.set("q", search);
    const qs = params.toString();
    return qs ? `/admin/solicitudes?${qs}` : "/admin/solicitudes";
  }

  const deadlineRows = rows.filter((r) => r.client_deadline && !["delivered", "cancelled"].includes(r.status));
  const unassignedRows = rows.filter((r) => {
    const assigned = r.assigned as unknown as { full_name: string | null } | null;
    return !assigned?.full_name && !["draft", "cancelled", "delivered"].includes(r.status);
  });
  const unpaidRows = rows.filter((r) => !r.is_paid && !["draft", "cancelled"].includes(r.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Busca, prioriza y abre expedientes sin perder contexto.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/solicitudes/nueva">
            <Plus className="h-4 w-4" />
            Nuevo proyecto
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100">
              <MessageSquare className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{clientMessageIds.size}</p>
              <p className="text-xs text-muted-foreground">Mensajes por responder</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-rose-100">
              <AlertTriangle className="h-5 w-5 text-rose-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{deadlineRows.length}</p>
              <p className="text-xs text-muted-foreground">Con fecha límite cliente</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100">
              <UserRoundX className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{unassignedRows.length}</p>
              <p className="text-xs text-muted-foreground">Activos sin asignar</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-100">
              <CircleDashed className="h-5 w-5 text-orange-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{unpaidRows.length}</p>
              <p className="text-xs text-muted-foreground">Pendientes de pago</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={buildHref({ status: s.value })}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              (status ?? "") === s.value
                ? "border-primary bg-primary text-white"
                : "border-border hover:border-primary/50"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Filtros por servicio */}
      {services.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Servicio:</span>
          <Link
            href={buildHref({ service: "" })}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              !serviceSlug
                ? "border-primary bg-primary text-white"
                : "border-border hover:border-primary/50"
            }`}
          >
            Todos
          </Link>
          {services.map((s) => (
            <Link
              key={s.id}
              href={buildHref({ service: s.slug })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                serviceSlug === s.slug
                  ? "border-primary bg-primary text-white"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <form className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Buscar por dirección o referencia..."
            defaultValue={search}
            className="pl-9"
          />
        </div>
        {status && <input type="hidden" name="status" value={status} />}
        {serviceSlug && <input type="hidden" name="service" value={serviceSlug} />}
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <Link key={r.id} href={`/admin/solicitudes/${r.id}`} className="block">
            <Card className={`transition-shadow hover:shadow-md ${r.client_deadline && r.status !== "delivered" && r.status !== "cancelled" ? "border-red-200 bg-red-50/40" : ""}`}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.property_address ?? "Sin dirección"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.reference_code ?? "Sin ref."} · {(r.organizations as unknown as { name: string } | null)?.name ?? "Sin cliente"}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{(r.service_types as unknown as { name: string } | null)?.name ?? "Sin servicio"}</span>
                  <span>Asignado: {(r.assigned as unknown as { full_name: string | null } | null)?.full_name ?? "sin asignar"}</span>
                  <span>Creado: {format(new Date(r.created_at), "dd/MM/yy")}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {clientMessageIds.has(r.id) && <MessageSquare className="h-4 w-4 text-blue-500" />}
                    {r.client_deadline && r.status !== "delivered" && r.status !== "cancelled" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        <AlertTriangle className="h-3 w-3" />
                        {format(new Date(r.client_deadline), "dd/MM/yy")}
                      </span>
                    )}
                    {r.status !== "draft" && r.status !== "cancelled" && (
                      r.is_paid ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <CircleDashed className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Abrir <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!rows.length && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {search ? `Sin proyectos para "${search}".` : "Sin solicitudes con este filtro."}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Referencia</th>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Servicio</th>
              <th className="px-4 py-3 text-left font-medium">Dirección</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Asignado</th>
              <th className="px-4 py-3 text-left font-medium">Pago</th>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-center font-medium" title="Mensajes del cliente">💬</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className={`hover:bg-muted/30 ${r.client_deadline && r.status !== "delivered" && r.status !== "cancelled" ? "bg-red-50/50" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    {r.client_deadline && r.status !== "delivered" && r.status !== "cancelled" && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    )}
                    {r.reference_code ?? <span className="text-muted-foreground">Sin ref.</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {(r.organizations as unknown as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {(r.service_types as unknown as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3">
                  {r.property_address ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {(r.assigned as unknown as { full_name: string | null } | null)?.full_name ?? (
                    <span className="opacity-40">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.status !== "draft" && r.status !== "cancelled" && (
                    r.is_paid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <CircleDashed className="h-4 w-4 text-orange-500" />
                    )
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{format(new Date(r.created_at), "dd/MM/yy")}</div>
                  {r.client_deadline && r.status !== "delivered" && r.status !== "cancelled" && (
                    <div className="text-[10px] font-semibold text-red-600">
                      Límite: {format(new Date(r.client_deadline), "dd/MM/yy")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {clientMessageIds.has(r.id) && (
                    <span title="Tiene mensajes del cliente"><MessageSquare className="inline h-4 w-4 text-blue-500" /></span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/solicitudes/${r.id}`}>
                      Ver
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {search ? `Sin proyectos para "${search}".` : "Sin solicitudes con este filtro."}
          </div>
        )}
      </div>
    </div>
  );
}
