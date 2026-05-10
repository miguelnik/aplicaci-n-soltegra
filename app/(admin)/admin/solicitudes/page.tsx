import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveServices } from "@/lib/services";
import { StatusBadge } from "@/components/client/StatusBadge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowRight, AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";

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
  searchParams: Promise<{ status?: string; service?: string }>;
}

export default async function AdminSolicitudesPage({ searchParams }: Props) {
  await requireAdmin();
  const { status, service: serviceSlug } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const services = await getActiveServices();
  const selectedService = serviceSlug ? services.find((s) => s.slug === serviceSlug) : null;

  let query = supabase
    .from("certificate_requests")
    .select(`id, reference_code, property_address, status, created_at, estimated_delivery_date, client_deadline, is_paid, organizations(name), service_types(name)`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);
  if (selectedService) query = query.eq("service_type_id", selectedService.id);

  const { data: requests } = await query;

  function buildHref(part: { status?: string; service?: string }): string {
    const params = new URLSearchParams();
    const finalStatus = part.status !== undefined ? part.status : status;
    const finalService = part.service !== undefined ? part.service : serviceSlug;
    if (finalStatus) params.set("status", finalStatus);
    if (finalService) params.set("service", finalService);
    const qs = params.toString();
    return qs ? `/admin/solicitudes?${qs}` : "/admin/solicitudes";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Solicitudes</h1>

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

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Referencia</th>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Servicio</th>
              <th className="px-4 py-3 text-left font-medium">Dirección</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Pago</th>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests?.map((r) => (
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
        {!requests?.length && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Sin solicitudes con este filtro.
          </div>
        )}
      </div>
    </div>
  );
}
