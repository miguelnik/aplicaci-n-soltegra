import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ProfileForm } from "./ProfileForm";

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
      .select("name, cif, contact_email, contact_phone")
      .eq("id", profile.organization_id)
      .single();

    if (org) {
      organization = {
        name: org.name,
        cif: org.cif ?? null,
        contactEmail: org.contact_email ?? null,
        contactPhone: org.contact_phone ?? null,
      };
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="text-muted-foreground">
          Gestiona tus datos personales y los datos de facturación de tu empresa.
        </p>
      </div>

      <ProfileForm
        profile={{
          fullName: profile.full_name,
          phone: profile.phone,
          email,
        }}
        organization={organization}
      />
    </div>
  );
}
