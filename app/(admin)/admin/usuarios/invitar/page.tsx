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

async function inviteUser(formData: FormData) {
  "use server";
  await requireAdmin();

  const email = formData.get("email") as string;
  const fullName = formData.get("full_name") as string;
  const orgId = formData.get("organization_id") as string;
  const role = (formData.get("role") as string) || "client";

  const adminClient = createSupabaseAdminClient();

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/set-password`,
      data: { full_name: fullName, organization_id: orgId || null, role },
    },
  );

  if (inviteError || !inviteData.user) {
    redirect("/admin/usuarios/invitar?error=" + encodeURIComponent(inviteError?.message ?? "Error desconocido"));
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: inviteData.user.id,
    organization_id: role === "admin" ? null : orgId || null,
    role: role as "admin" | "client",
    full_name: fullName || null,
  });

  if (profileError) {
    redirect("/admin/usuarios/invitar?error=" + encodeURIComponent("Usuario creado pero error al guardar perfil: " + profileError.message));
  }

  redirect("/admin/usuarios?invited=1");
}

interface Props {
  searchParams: Promise<{ org?: string; error?: string }>;
}

export default async function InvitarUsuarioPage({ searchParams }: Props) {
  await requireAdmin();
  const { org: preselectedOrg, error } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invitar usuario</h1>
        <p className="text-muted-foreground">
          El usuario recibirá un email para establecer su contraseña.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del usuario</CardTitle>
          <CardDescription>
            Para clientes, asigna una organización existente. Si todavía no existe,{" "}
            <Link href="/admin/clientes/nuevo" className="text-primary hover:underline">
              créala primero
            </Link>
            . Los admins no necesitan organización.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={inviteUser} className="space-y-4">
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
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input id="full_name" name="full_name" placeholder="María García López" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <select
                id="role"
                name="role"
                defaultValue="client"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="client">Cliente</option>
                <option value="admin">Admin Soltegra</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization_id">
                Organización <span className="text-xs text-muted-foreground">(solo para clientes)</span>
              </Label>
              <select
                id="organization_id"
                name="organization_id"
                defaultValue={preselectedOrg ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sin organización (admin)</option>
                {orgs?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <SubmitButton className="flex-1" pendingText="Enviando invitación...">
                Enviar invitación
              </SubmitButton>
              <Button variant="outline" asChild>
                <Link href="/admin/usuarios">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
