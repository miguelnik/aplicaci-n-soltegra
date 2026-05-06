import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import { format } from "date-fns";
import { UserPlus } from "lucide-react";

async function updateOrg(orgId: string, formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  await supabase
    .from("organizations")
    .update({
      name: formData.get("name") as string,
      cif: (formData.get("cif") as string) || null,
      contact_email: (formData.get("contact_email") as string) || null,
      contact_phone: (formData.get("contact_phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", orgId);

  redirect(`/admin/clientes/${orgId}?saved=1`);
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}

export default async function ClienteDetallePage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (!org) notFound();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .eq("organization_id", id);

  const { data: requests } = await supabase
    .from("certificate_requests")
    .select("id, reference_code, property_address, status, created_at")
    .eq("organization_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  const updateOrgBound = updateOrg.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin/clientes" className="hover:text-primary">
              Clientes
            </Link>
            <span>/</span>
            <span>{org.name}</span>
          </div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
        </div>
        <Button asChild>
          <Link href={`/admin/usuarios/invitar?org=${id}`}>
            <UserPlus className="h-4 w-4" />
            Invitar usuario
          </Link>
        </Button>
      </div>

      {saved && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          Datos guardados correctamente.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario de edición */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos de la organización</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateOrgBound} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input id="name" name="name" required defaultValue={org.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cif">CIF / NIF</Label>
                <Input id="cif" name="cif" defaultValue={org.cif ?? ""} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    name="contact_email"
                    type="email"
                    defaultValue={org.contact_email ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Teléfono</Label>
                  <Input
                    id="contact_phone"
                    name="contact_phone"
                    defaultValue={org.contact_phone ?? ""}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas internas</Label>
                <Textarea id="notes" name="notes" rows={3} defaultValue={org.notes ?? ""} />
              </div>
              <Button type="submit" size="sm">
                Guardar cambios
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Usuarios */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Usuarios ({users?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {users && users.length > 0 ? (
                <ul className="space-y-2">
                  {users.map((u) => (
                    <li key={u.id} className="flex items-center justify-between text-sm">
                      <span>{u.full_name ?? "Sin nombre"}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(u.created_at), "dd/MM/yyyy")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin usuarios.{" "}
                  <Link
                    href={`/admin/usuarios/invitar?org=${id}`}
                    className="text-primary hover:underline"
                  >
                    Invitar primero
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Últimas solicitudes */}
          {requests && requests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Últimas solicitudes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {requests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <Link
                        href={`/admin/solicitudes/${r.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r.reference_code ?? "—"}
                      </Link>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
