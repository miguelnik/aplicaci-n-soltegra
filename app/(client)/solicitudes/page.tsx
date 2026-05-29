import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/client/StatusBadge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  PlusCircle,
  Search,
  Send,
} from "lucide-react";

interface Props {
  searchParams: Promise<{ q?: string; status?: string }>;
}

const FILTERS = [
  { value: "", label: "Todas" },
  { value: "active", label: "En curso" },
  { value: "delivered", label: "Entregadas" },
  { value: "draft", label: "Borradores" },
  { value: "cancelled", label: "Canceladas" },
];

export default async function SolicitudesPage({ searchParams }: Props) {
  const profile = await requireClient();
  const { q: searchQuery, status: filterStatus } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: allRequests } = await supabase
    .from("certificate_requests")
    .select("id, status, property_address, reference_code, estimated_delivery_date, client_deadline, created_at, certificate_pdf_path, service_types(name)")
    .eq("organization_id", profile.organization_id!)
    .order("created_at", { ascending: false });

  const all = allRequests ?? [];
  const counts = {
    total: all.filter((r) => r.status !== "cancelled").length,
    active: all.filter((r) => !["draft", "delivered", "cancelled"].includes(r.status)).length,
    delivered: all.filter((r) => r.status === "delivered").length,
    draft: all.filter((r) => r.status === "draft").length,
    awaitingInfo: all.filter((r) => r.status === "awaiting_info").length,
  };

  let requests = allRequests ?? [];

  if (filterStatus) {
    if (filterStatus === "active") {
      requests = requests.filter((r) => !["draft", "delivered", "cancelled"].includes(r.status));
    } else {
      requests = requests.filter((r) => r.status === filterStatus);
    }
  } else {
    // "Todas" excluye canceladas por defecto (accesibles con el filtro explícito)
    requests = requests.filter((r) => r.status !== "cancelled");
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    requests = requests.filter(
      (r) =>
        r.property_address?.toLowerCase().includes(q) ||
        r.reference_code?.toLowerCase().includes(q),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Consulta el estado, descarga entregables y continúa solicitudes pendientes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/solicitudes/nueva">
              <PlusCircle className="h-4 w-4" />
              Nueva solicitud
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { href: "/solicitudes", label: "Total", value: counts.total, icon: FileText, active: !filterStatus },
          { href: "/solicitudes?status=active", label: "En curso", value: counts.active, icon: Clock, active: filterStatus === "active" },
          { href: "/solicitudes?status=awaiting_info", label: "Pendiente info", value: counts.awaitingInfo, icon: AlertCircle, active: filterStatus === "awaiting_info" },
          { href: "/solicitudes?status=delivered", label: "Entregadas", value: counts.delivered, icon: CheckCircle2, active: filterStatus === "delivered" },
          { href: "/solicitudes?status=draft", label: "Borradores", value: counts.draft, icon: Send, active: filterStatus === "draft" },
        ].map((item) => (
          <Link key={item.label} href={item.href}>
            <Card className={`h-full transition-shadow hover:shadow-md ${item.active ? "ring-2 ring-primary" : ""}`}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/solicitudes?status=${f.value}${searchQuery ? `&q=${searchQuery}` : ""}` : `/solicitudes${searchQuery ? `?q=${searchQuery}` : ""}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              (filterStatus ?? "") === f.value
                ? "border-primary bg-primary text-white"
                : "border-border hover:border-primary/50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Buscador */}
      <form className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Buscar por dirección o referencia..."
            defaultValue={searchQuery ?? ""}
            className="pl-9"
          />
        </div>
        {filterStatus && <input type="hidden" name="status" value={filterStatus} />}
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {requests.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {requests.map((req) => (
            <Link key={req.id} href={`/solicitudes/${req.id}`} className="block">
              <Card className={`h-full cursor-pointer transition-shadow hover:shadow-md ${req.status === "awaiting_info" ? "border-amber-200 bg-amber-50/40" : ""}`}>
                <CardContent className="flex h-full flex-col gap-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                    {(req.service_types as unknown as { name: string } | null)?.name && (
                      <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {(req.service_types as unknown as { name: string }).name}
                      </span>
                    )}
                      <p className="truncate font-medium">{req.property_address ?? "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.reference_code ?? "Borrador"} · {format(new Date(req.created_at), "dd/MM/yyyy")}
                    </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {req.status === "awaiting_info" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <AlertCircle className="h-3 w-3" />
                        Requiere respuesta
                      </span>
                    )}
                    {(req.client_deadline ?? req.estimated_delivery_date) && req.status !== "delivered" && req.status !== "draft" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                        <Clock className="h-3 w-3" />
                        {format(new Date(req.client_deadline ?? req.estimated_delivery_date!), "d MMM yyyy", { locale: es })}
                      </span>
                    )}
                    {req.status === "delivered" && req.certificate_pdf_path && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        <Download className="h-3 w-3" />
                        Descarga disponible
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-muted-foreground">
                      Última referencia: {req.reference_code ?? "borrador"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Abrir <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">
                {searchQuery ? "Sin resultados" : "Aún no tienes proyectos"}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? `No encontramos proyectos para "${searchQuery}".`
                  : "Crea una nueva solicitud para iniciar el seguimiento desde el portal."}
              </p>
            </div>
            {!searchQuery && (
              <Button asChild>
                <Link href="/solicitudes/nueva">
                  <PlusCircle className="h-4 w-4" />
                  Nueva solicitud
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
