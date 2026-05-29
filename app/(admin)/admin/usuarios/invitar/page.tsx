import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { AlertTriangle, ArrowLeft, Building2, KeyRound, ShieldCheck, UserPlus, Users } from "lucide-react";

async function createUser(formData: FormData) {
  "use server";
  const { revalidateTag } = await import("next/cache");
  const cp = await requireAdmin();
  const isSuperAdmin = cp.role === "superadmin";

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;
  const orgId = formData.get("organization_id") as string;
  const rawRole = (formData.get("role") as string) || "client";

  // Solo superadmin puede crear admins o superadmins
  const role: "client" | "admin" | "superadmin" =
    isSuperAdmin && (rawRole === "admin" || rawRole === "superadmin")
      ? rawRole
      : "client";

  if (!password || password.length < 6) {
    redirect("/admin/usuarios/invitar?error=" + encodeURIComponent("La contraseña debe tener al menos 6 caracteres"));
  }

  const adminClient = createSupabaseAdminClient();

  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, organization_id: orgId || null, role },
  });

  if (createError || !userData.user) {
    redirect("/admin/usuarios/invitar?error=" + encodeURIComponent(createError?.message ?? "Error desconocido"));
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userData.user.id,
    organization_id: role === "client" ? (orgId || null) : null,
    role,
    full_name: fullName || null,
  });

  if (profileError) {
    redirect("/admin/usuarios/invitar?error=" + encodeURIComponent("Usuario creado pero error al guardar perfil: " + profileError.message));
  }

  // Invalidar cache de emails para que el nuevo usuario aparezca al instante
  revalidateTag("user-emails");

  redirect("/admin/usuarios?invited=1");
}

interface Props {
  searchParams: Promise<{ org?: string; error?: string }>;
}

export default async function CrearUsuarioPage({ searchParams }: Props) {
  const currentProfile = await requireAdmin();
  const isSuperAdmin = currentProfile.role === "superadmin";
  const { org: preselectedOrg, error } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/usuarios" aria-label="Volver a usuarios">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary">Nuevo acceso</p>
              <h1 className="text-2xl font-bold tracking-tight">Crear usuario</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Crea el usuario con email y contraseña. Después podrás compartirle los datos de acceso.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin/usuarios">
              <Users className="h-4 w-4" />
              Ver usuarios
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-primary" />
              Datos del usuario
            </CardTitle>
            <CardDescription>
              Para clientes, asigna una organización existente. Si todavía no existe,{" "}
              <Link href="/admin/clientes/nuevo" className="font-medium text-primary hover:underline">
                créala primero
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createUser} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="cliente@empresa.es"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Contraseña <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="text"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Nombre completo</Label>
                <Input id="full_name" name="full_name" placeholder="María García López" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <select
                    id="role"
                    name="role"
                    defaultValue="client"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="client">Cliente</option>
                    {isSuperAdmin && (
                      <>
                        <option value="admin">Admin Soltegra</option>
                        <option value="superadmin">Superadministrador</option>
                      </>
                    )}
                  </select>
                  {!isSuperAdmin && (
                    <p className="text-xs text-muted-foreground">
                      Solo puedes crear clientes. Contacta con un superadmin para crear administradores.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization_id">
                    Organización <span className="text-xs text-muted-foreground">(solo clientes)</span>
                  </Label>
                  <select
                    id="organization_id"
                    name="organization_id"
                    defaultValue={preselectedOrg ?? ""}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Sin organización (admin/superadmin)</option>
                    {orgs?.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
                <Button variant="outline" className="sm:w-40" asChild>
                  <Link href="/admin/usuarios">Cancelar</Link>
                </Button>
                <SubmitButton className="flex-1" pendingText="Creando...">
                  Crear usuario
                </SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <p className="font-medium">Cliente</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Accede al portal, ve sus proyectos y puede completar información o aportar archivos.
            </p>
          </div>
          <div className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="font-medium">Admin Soltegra</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Gestiona expedientes y clientes. Los permisos superiores quedan reservados al superadmin.
            </p>
          </div>
          <div className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <p className="font-medium">Contraseña inicial</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Debe tener al menos 6 caracteres. El usuario puede cambiarla después si lo necesita.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
