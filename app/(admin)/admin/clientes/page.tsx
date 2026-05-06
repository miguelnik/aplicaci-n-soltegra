import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, PlusCircle, Users } from "lucide-react";

export default async function ClientesPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select(`
      id, name, cif, contact_email, contact_phone, created_at,
      profiles(count),
      certificate_requests(count)
    `)
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button asChild>
          <Link href="/admin/clientes/nuevo">
            <PlusCircle className="h-4 w-4" />
            Nuevo cliente
          </Link>
        </Button>
      </div>

      {orgs && orgs.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => {
            const userCount = (org.profiles as unknown as { count: number }[])?.[0]?.count ?? 0;
            const reqCount =
              (org.certificate_requests as unknown as { count: number }[])?.[0]?.count ?? 0;

            return (
              <Link key={org.id} href={`/admin/clientes/${org.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="pt-4">
                    <div className="mb-2 flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{org.name}</p>
                        {org.cif && (
                          <p className="text-xs text-muted-foreground">{org.cif}</p>
                        )}
                      </div>
                    </div>
                    {org.contact_email && (
                      <p className="mb-2 truncate text-sm text-muted-foreground">
                        {org.contact_email}
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {userCount} usuario{userCount !== 1 ? "s" : ""}
                      </span>
                      <span>{reqCount} certificado{reqCount !== 1 ? "s" : ""}</span>
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
            <p className="font-medium">Sin clientes todavía</p>
            <p className="text-sm text-muted-foreground">
              Crea el primer cliente para poder invitarle a la plataforma.
            </p>
            <Button asChild>
              <Link href="/admin/clientes/nuevo">
                <PlusCircle className="h-4 w-4" />
                Nuevo cliente
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
