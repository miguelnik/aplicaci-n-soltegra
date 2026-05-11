import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { fullName, phone, orgName, orgCif, orgEmail, orgPhone, orgAddress } =
      (await request.json()) as {
        fullName: string;
        phone: string;
        orgName: string;
        orgCif: string;
        orgEmail: string;
        orgPhone: string;
        orgAddress: string;
      };

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    // 1. Actualizar perfil personal (RLS permite al usuario actualizar el suyo)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      return NextResponse.json(
        { ok: false, error: `Perfil: ${profileError.message}` },
        { status: 400 },
      );
    }

    // 2. Obtener org_id del perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.organization_id) {
      // 3. Actualizar datos de la organización usando admin client
      const adminClient = createSupabaseAdminClient();
      const { error: orgError } = await adminClient
        .from("organizations")
        .update({
          name: orgName.trim() || undefined,
          cif: orgCif.trim() || null,
          contact_email: orgEmail.trim() || null,
          contact_phone: orgPhone.trim() || null,
          billing_address: orgAddress.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.organization_id);

      if (orgError) {
        return NextResponse.json(
          { ok: false, error: `Organización: ${orgError.message}` },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
