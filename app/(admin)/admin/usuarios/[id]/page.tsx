import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin, getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ShieldAlert } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; pwok?: string }>;
}

export default async function EditarUsuarioPage({ params, searchParams }: Props) {
  const currentProfile = await requireAdmin();
  const { id } = await params;
  const { error, pwok } = await searchParams;

  const isSuperAdmin = currentProfile.role === "superadmin";

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const [{ data: profile }, { data: authData }, { data: orgs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, phone, organization_id, created_at")
      .eq("id", id)
      .single(),
    adminClient.auth.admin.getUserById(id),
    supabase.from("organizations").select("id, name").order("name"),
  ]);

  if (!profile) notFound();

  // Un admin normal no puede editar a otros admins ni superadmins
  const targetIsPrivileged = profile.role === "admin" || profile.role === "superadmin";
  if (!isSuperAdmin && targetIsPrivileged) {
    redirect("/admin/usuarios?error=" + encodeURIComponent("No tienes permiso para editar a este usuario"));
  }

  const email = authData?.user?.email ?? "—";

  async function handleUpdate(formData: FormData) {
    "use server";
    const cp = await requireAdmin();
    const isSA = cp.role === "superadmin";

    const fullName = formData.get("full_name") as string;
    const phone = formData.get("phone") as string;
    const rawRole = formData.get("role") as string;
    const orgId = formData.get("organization_id") as string;

    // Solo superadmin puede asignar roles admin/superadmin
    const role = isSA
      ? (rawRole as "admin" | "client" | "superadmin")
      : "client";

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        phone: phone || null,
        role,
        organization_id: role === "client" ? (orgId || null) : null,
      })
      .eq("id", id);

    if (error) {
      redirect(`/admin/usuarios/${id}?error=${encodeURIComponent(error.message)}`);
    }
    redirect("/admin/usuarios?updated=1");
  }

  async function handleSetPassword(formData: FormData) {
    "use server";
    await requireAdmin();

    const password = formData.get("password") as string;
    if (!password || password.length < 8) {
      redirect(
        `/admin/usuarios/${id}?error=${encodeURIComponent("La contraseña debe tener al menos 8 caracteres")}`,
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(id, { password });

    if (error) {
      redirect(`/admin/usuarios/${id}?error=${encodeURIComponent(error.message)}`);
    }
    redirect(`/admin/usuarios/${id}?pwok=1`);
  }

  async function handleDelete() {
    "use server";
    const cp = await requireAdmin();

    const currentProfile = await getCurrentProfile();
    if (currentProfile?.id === id) {
      redirect(
        `/admin/usuarios/${id}?error=${encodeURIComponent("No puedes eliminar tu propia cuenta")}`,
      );
    }

    // Sólo superadmin puede eliminar admins y superadmins
    const { data: targetProfile } = await (await createSupabaseServerClient())
      .from("profiles")
      .select("role")
      .eq("id", id)
      .single();

    const targetRole = targetProfile?.role;
    if (
      (targetRole === "admin" || targetRole === "superadmin") &&
      cp.role !== "superadmin"
    ) {
      redirect(
        `/admin/usuarios/${id}?error=${encodeURIComponent("Solo un superadmin puede eliminar administradores")}`,
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(id);

    if (error) {
      redirect(`/admin/usuarios/${id}?error=${encodeURIComponent(error.message)}`);
    }
    redirect("/admin/usuarios?deleted=1");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/usuarios">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Editar usuario</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      {/* Aviso si el usuario es superadmin */}
      {profile.role === "superadmin" && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Este usuario es <strong>Superadministrador</strong>. Edita con precaución.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Email (no editable)</Label>
              <Input value={email} disabled className="bg-muted/50" readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile.full_name ?? ""}
                placeholder="María García López"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={profile.phone ?? ""}
                placeholder="+34 600 000 000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization_id">Organización</Label>
              <select
                id="organization_id"
                name="organization_id"
                defaultValue={profile.organization_id ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— Ninguna (Admin Soltegra) —</option>
                {orgs?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <select
                id="role"
                name="role"
                defaultValue={profile.role}
                disabled={!isSuperAdmin}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="client">Cliente</option>
                <option value="admin">Admin Soltegra</option>
                {isSuperAdmin && (
                  <option value="superadmin">Superadministrador</option>
                )}
              </select>
              {!isSuperAdmin && (
                <p className="text-xs text-muted-foreground">
                  Solo un superadmin puede cambiar el rol.
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1">
                Guardar cambios
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/usuarios">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Establecer contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          {pwok && (
            <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">
              Contraseña actualizada correctamente.
            </div>
          )}
          <form action={handleSetPassword} className="flex gap-2">
            <Input
              name="password"
              type="text"
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              minLength={8}
              required
              className="flex-1"
            />
            <Button type="submit" variant="secondary">
              Guardar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Zona peligrosa</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Eliminar este usuario borra su cuenta y acceso permanentemente. Sus solicitudes
            quedan registradas en el sistema.
          </p>
          {(profile.role === "admin" || profile.role === "superadmin") && !isSuperAdmin ? (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Solo un superadministrador puede eliminar administradores.
            </p>
          ) : (
            <form action={handleDelete}>
              <Button type="submit" variant="destructive" className="w-full">
                Eliminar usuario
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
