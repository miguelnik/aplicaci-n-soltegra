import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ProfileForm } from "./ProfileForm";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Mail, ShieldCheck, User } from "lucide-react";

export default async function PerfilPage() {
  const profile = await requireClient();
  const supabase = await createSupabaseServerClient();

  // Email del usuario autenticado (solo disponible en auth, no en profiles)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";

  // Datos de la organización si existe
  let organization = null;
  if (profile.organization_id) {
    const adminClient = createSupabaseAdminClient();
    const { data: org } = await adminClient
      .from("organizations")
      .select("name, cif, contact_email, contact_phone, billing_address")
      .eq("id", profile.organization_id)
      .single();

    if (org) {
      organization = {
        name: org.name,
        cif: org.cif ?? null,
        contactEmail: org.contact_email ?? null,
        contactPhone: org.contact_phone ?? null,
        billingAddress: org.billing_address ?? null,
      };
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h1 className="text-2xl font-bold">Mi cuenta</h1>
          <p className="mt-1 text-muted-foreground">
            Gestiona tus datos personales, los datos de facturación y la seguridad de acceso.
          </p>
        </div>
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10">
              <ShieldCheck className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Cuenta protegida</p>
              <p className="text-sm text-white/75">
                Usa una contraseña segura y mantén tus datos de contacto actualizados.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile.full_name ?? "Sin nombre"}</p>
              <p className="text-xs text-muted-foreground">Usuario</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{email || "Sin email"}</p>
              <p className="text-xs text-muted-foreground">Acceso</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{organization?.name ?? "Sin empresa"}</p>
              <p className="text-xs text-muted-foreground">Facturación</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ProfileForm
        profile={{
          fullName: profile.full_name,
          phone: profile.phone,
          email,
        }}
        organization={organization}
      />
      <ChangePasswordForm />
    </div>
  );
}
