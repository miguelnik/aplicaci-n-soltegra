import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  fullName: z.string().max(200).optional().default(""),
  phone: z.string().max(50).optional().default(""),
  orgName: z.string().max(200).optional().default(""),
  orgCif: z.string().max(50).optional().default(""),
  orgEmail: z.string().max(200).optional().default(""),
  orgPhone: z.string().max(50).optional().default(""),
  orgAddress: z.string().max(500).optional().default(""),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }
    const { fullName, phone, orgName, orgCif, orgEmail, orgPhone, orgAddress } = parsed.data;

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    // Comprobar rol antes de tocar nada — esta ruta es exclusivamente para clientes.
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "client") {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
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
        { ok: false, error: "No se pudo actualizar el perfil" },
        { status: 400 },
      );
    }

    // 2. Actualizar datos de la organización SOLO si el usuario pertenece a una.
    //    Nota intencionada: todos los miembros de la organización comparten estos
    //    datos (ver copia del formulario). Si en el futuro se quiere restringir
    //    a un "owner", añadir profiles.is_org_owner y filtrar aquí.
    if (profile.organization_id) {
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
          { ok: false, error: "No se pudieron actualizar los datos de facturación" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
