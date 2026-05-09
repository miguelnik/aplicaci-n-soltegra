import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import { BillingTable } from "@/components/admin/BillingTable";
import { SubmitButton } from "@/components/ui/submit-button";
import { format } from "date-fns";
import { UserPlus, Trash2 } from "lucide-react";

async function updateOrg(orgId: string, formData: FormData) {
  "use server";
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      name: formData.get("name") as string,
      cif: (formData.get("cif") as string) || null,
      contact_email: (formData.get("contact_email") as string) || null,
      contact_phone: (formData.get("contact_phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", orgId);

  if (error) {
    redirect(`/admin/clientes/${orgId}?error=${encodeURIComponent("Error al guardar: " + error.message)}`);
  }
  redirect(`/admin/clientes/${orgId}?saved=1`);
}

async function deleteOrg(orgId: string) {
  "use server";
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (count && count > 0) {
    redirect(`/admin/clientes/${orgId}?error=${encodeURIComponent("No se puede eliminar: tiene usuarios asignados. Elimínalos primero.")}`);
  }

  const { count: reqCount } = await admin
    .from("certificate_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (reqCount && reqCount > 0) {
    redirect(`/admin/clientes/${orgId}?error=${encodeURIComponent("No se puede eliminar: tiene solicitudes asociadas.")}`);
  }

  const { error } = await admin.from("organizations").delete().eq("id", orgId);

  if (error) {
    redirect(`/admin/clientes/${orgId}?error=${encodeURIComponent("Error al eliminar: " + error.message)}`);
  }
  redirect("/admin/clientes?deleted=1");
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}

export default async function ClienteDetallePage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { saved, error } = await searchParams;
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

  // Traer TODAS las solicitudes para la tabla de facturación
  const { data: allRequests } = await supabase
    .from("certificate_requests")
    .select("id, reference_code, property_address, status, is_paid, paid_at, delivered_at, created_at")
    .eq("organization_id", id)
    .order("created_at", { ascending: false });

  const requests = allRequests ?? [];

  const updateOrgBound = updateOrg.bind(null, id);
  const deleteOrgBound = deleteOrg.bind(null, id);

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
            Crear usuario
          </Link>
        </Button>
      </div>

      {saved && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          Datos guardados correctamente.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Sección de facturación — ancho completo */}
      <BillingTable requests={requests} orgName={org.name} />

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
              <SubmitButton size="sm" pendingText="Guardando...">
                Guardar cambios
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        {/* Usuarios + últimas solicitudes */}
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
                    Crear usuario
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Últimas solicitudes */}
          {requests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Últimas solicitudes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {requests.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <Link
                        href={`/admin/solicitudes/${r.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r.reference_code ?? "—"}
                      </Link>
                      <StatusBadge status={r.status as "submitted"} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Eliminar organización */}
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-destructive">Zona peligrosa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                Eliminar esta organización. Solo posible si no tiene usuarios ni solicitudes.
              </p>
              <form action={deleteOrgBound}>
                <SubmitButton
                  variant="destructive"
                  size="sm"
                  pendingText="Eliminando..."
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar organización
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
