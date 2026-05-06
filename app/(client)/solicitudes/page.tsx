import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/client/StatusBadge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, Download, PlusCircle, Search } from "lucide-react";

interface Props {
  searchParams: Promise<{ q?: string; status?: string }>;
}

const FILTERS = [
  { value: "", label: "Todas" },
  { value: "active", label: "En curso" },
  { value: "delivered", label: "Entregadas" },
  { value: "draft", label: "Borradores" },
];

export default async function SolicitudesPage({ searchParams }: Props) {
  const profile = await requireClient();
  const { q: searchQuery, status: filterStatus } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: allRequests } = await supabase
    .from("certificate_requests")
    .select("id, status, property_address, reference_code, estimated_delivery_date, created_at, certificate_pdf_path")
    .eq("organization_id", profile.organization_id!)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false });

  let requests = allRequests ?? [];

  if (filterStatus) {
    if (filterStatus === "active") {
      requests = requests.filter((r) => !["draft", "delivered", "cancelled"].includes(r.status));
    } else {
      requests = requests.filter((r) => r.status === filterStatus);
    }
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Mis certificados</h1>
        <Button asChild>
          <Link href="/solicitudes/nueva">
            <PlusCircle className="h-4 w-4" />
            Nueva solicitud
          </Link>
        </Button>
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
      <form className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          placeholder="Buscar por dirección o referencia..."
          defaultValue={searchQuery ?? ""}
          className="pl-9"
        />
        {filterStatus && <input type="hidden" name="status" value={filterStatus} />}
      </form>

      {requests.length > 0 ? (
        <div className="space-y-2">
          {requests.map((req) => (
            <Link key={req.id} href={`/solicitudes/${req.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-medium">{req.property_address ?? "Sin dirección"}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.reference_code ?? "Borrador"} · {format(new Date(req.created_at), "dd/MM/yyyy")}
                    </p>
                    {req.estimated_delivery_date && req.status !== "delivered" && req.status !== "draft" && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Entrega: {format(new Date(req.estimated_delivery_date), "d MMM yyyy", { locale: es })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {req.status === "delivered" && req.certificate_pdf_path && (
                      <Download className="h-4 w-4 text-green-600" />
                    )}
                    <StatusBadge status={req.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery
              ? `Sin resultados para "${searchQuery}"`
              : "Sin solicitudes todavía."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
