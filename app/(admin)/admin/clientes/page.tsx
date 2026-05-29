import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDashed,
  FileText,
  Mail,
  Phone,
  PlusCircle,
  Search,
  Users,
} from "lucide-react";

interface Props {
  searchParams?: Promise<{ q?: string }>;
}

export default async function ClientesPage({ searchParams }: Props) {
  await requireAdmin();
  const { q: rawSearch } = (await searchParams) ?? {};
  const search = rawSearch?.trim() ?? "";
  const normalizedSearch = search.toLowerCase();
  const supabase = await createSupabaseServerClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select(`
      id, name, cif, contact_email, contact_phone, created_at,
      profiles(count),
      certificate_requests(id, status, is_paid)
    `)
    .order("name");

  const rows = (orgs ?? []).filter((org) => {
    if (!normalizedSearch) return true;
    return (
      org.name?.toLowerCase().includes(normalizedSearch) ||
      org.cif?.toLowerCase().includes(normalizedSearch) ||
      org.contact_email?.toLowerCase().includes(normalizedSearch) ||
      org.contact_phone?.toLowerCase().includes(normalizedSearch)
    );
  });
  const totals = (orgs ?? []).reduce(
    (acc, org) => {
      const userCount = (org.profiles as unknown as { count: number }[])?.[0]?.count ?? 0;
      const reqs = (org.certificate_requests as unknown as { id: string; status: string; is_paid: boolean }[]) ?? [];
      const billable = reqs.filter((r) => r.status !== "draft" && r.status !== "cancelled");
      acc.clients += 1;
      acc.users += userCount;
      acc.projects += reqs.length;
      acc.unpaid += billable.filter((r) => !r.is_paid).length;
      return acc;
    },
    { clients: 0, users: 0, projects: 0, unpaid: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Consulta clientes, usuarios asociados, proyectos y estado de cobro.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/clientes/nuevo">
            <PlusCircle className="h-4 w-4" />
            Nuevo cliente
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Clientes", value: totals.clients, icon: Building2 },
          { label: "Usuarios", value: totals.users, icon: Users },
          { label: "Proyectos", value: totals.projects, icon: FileText },
          { label: "Pendientes de cobro", value: totals.unpaid, icon: CircleDashed },
        ].map((item) => (
          <Card key={item.label}>
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
        ))}
      </div>

      <form className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Buscar por nombre, CIF, email o teléfono..."
            defaultValue={search}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {rows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((org) => {
            const userCount = (org.profiles as unknown as { count: number }[])?.[0]?.count ?? 0;
            const reqs = (org.certificate_requests as unknown as { id: string; status: string; is_paid: boolean }[]) ?? [];
            // Solo contamos facturables (no borradores ni canceladas)
            const billable = reqs.filter((r) => r.status !== "draft" && r.status !== "cancelled");
            const paidCount = billable.filter((r) => r.is_paid).length;
            const unpaidCount = billable.length - paidCount;

            return (
              <Link key={org.id} href={`/admin/clientes/${org.id}`} className="block">
                <Card className={`h-full cursor-pointer transition-shadow hover:shadow-md ${unpaidCount > 0 ? "border-orange-200 bg-orange-50/30" : ""}`}>
                  <CardContent className="flex h-full flex-col gap-4 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{org.name}</p>
                        {org.cif && (
                          <p className="text-xs text-muted-foreground">{org.cif}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      {org.contact_email && (
                        <p className="flex min-w-0 items-center gap-2">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{org.contact_email}</span>
                        </p>
                      )}
                      {org.contact_phone && (
                        <p className="flex min-w-0 items-center gap-2">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{org.contact_phone}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {userCount} usuario{userCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {reqs.length} proyecto{reqs.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {billable.length > 0 && (
                      <div className="flex gap-3 border-t pt-3 text-xs">
                        <span className="flex items-center gap-1 text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {paidCount} cobrado{paidCount !== 1 ? "s" : ""}
                        </span>
                        {unpaidCount > 0 && (
                          <span className="flex items-center gap-1 text-orange-600">
                            <CircleDashed className="h-3 w-3" />
                            {unpaidCount} pendiente{unpaidCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-end border-t pt-3">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Abrir cliente <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">{search ? "Sin resultados" : "Sin clientes todavía"}</p>
            <p className="text-sm text-muted-foreground">
              {search
                ? `No hay clientes que coincidan con "${search}".`
                : "Crea el primer cliente para poder invitarle a la plataforma."}
            </p>
            {!search && (
              <Button asChild>
                <Link href="/admin/clientes/nuevo">
                  <PlusCircle className="h-4 w-4" />
                  Nuevo cliente
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
