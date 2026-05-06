import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import {
  PlusCircle,
  FileText,
  Download,
  Clock,
  CheckCircle2,
  Search,
  Loader2,
  Send,
  Copy,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function ClientDashboardPage({ searchParams }: Props) {
  const profile = await requireClient();
  const { status: filterStatus, q: searchQuery } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const orgId = profile.organization_id!;

  const { data: allRequests } = await supabase
    .from("certificate_requests")
    .select("id, status, property_address, reference_code, estimated_delivery_date, created_at, certificate_pdf_path")
    .eq("organization_id", orgId)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false });

  const requests = allRequests ?? [];

  const counts = {
    total: requests.length,
    active: requests.filter((r) => !["draft", "delivered", "cancelled"].includes(r.status)).length,
    delivered: requests.filter((r) => r.status === "delivered").length,
    draft: requests.filter((r) => r.status === "draft").length,
  };

  let filtered = requests;
  if (filterStatus) {
    if (filterStatus === "active") {
      filtered = filtered.filter((r) => !["draft", "delivered", "cancelled"].includes(r.status));
    } else {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.property_address?.toLowerCase().includes(q) ||
        r.reference_code?.toLowerCase().includes(q),
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Hola{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground">Panel de certificados energéticos</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/solicitudes/nueva">
              <PlusCircle className="h-4 w-4" />
              Nueva solicitud
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/solicitudes/lote">
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">Solicitud en lote</span>
              <span className="sm:hidden">Lote</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/dashboard">
          <Card className={`cursor-pointer transition-shadow hover:shadow-md ${!filterStatus ? "ring-2 ring-primary" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard?status=active">
          <Card className={`cursor-pointer transition-shadow hover:shadow-md ${filterStatus === "active" ? "ring-2 ring-orange-500" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                  <Loader2 className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts.active}</p>
                  <p className="text-xs text-muted-foreground">En curso</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard?status=delivered">
          <Card className={`cursor-pointer transition-shadow hover:shadow-md ${filterStatus === "delivered" ? "ring-2 ring-green-500" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts.delivered}</p>
                  <p className="text-xs text-muted-foreground">Entregados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard?status=draft">
          <Card className={`cursor-pointer transition-shadow hover:shadow-md ${filterStatus === "draft" ? "ring-2 ring-gray-400" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <Send className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts.draft}</p>
                  <p className="text-xs text-muted-foreground">Borradores</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
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

      {/* Lista de solicitudes */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((req) => (
            <Link key={req.id} href={`/solicitudes/${req.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-medium">{req.property_address ?? "Sin dirección"}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.reference_code ?? "Borrador"} · {format(new Date(req.created_at), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={req.status} />
                    {req.estimated_delivery_date && req.status !== "delivered" && req.status !== "draft" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                        <Clock className="h-3 w-3" />
                        {format(new Date(req.estimated_delivery_date), "d MMM yyyy", { locale: es })}
                      </span>
                    )}
                    {req.status === "delivered" && req.certificate_pdf_path && (
                      <Download className="h-4 w-4 text-green-600" />
                    )}
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
                {searchQuery ? "Sin resultados" : "Sin certificados todavía"}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? `No hay solicitudes que coincidan con "${searchQuery}"`
                  : "Crea tu primera solicitud para empezar"}
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
