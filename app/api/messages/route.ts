import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendNuevoMensaje } from "@/lib/email/send";

/**
 * POST /api/messages
 * Body: { requestId: string, body: string }
 *
 * El rol del autor se infiere del perfil del usuario autenticado.
 * RLS controla los permisos finales (cliente solo en sus solicitudes,
 * admin en cualquiera).
 */
export async function POST(request: NextRequest) {
  try {
    const { requestId, body } = (await request.json()) as {
      requestId: string;
      body: string;
    };

    if (!requestId || !body?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos (requestId, body)" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Sin perfil" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("request_messages")
      .insert({
        request_id: requestId,
        author_id: user.id,
        author_role: profile.role,
        body: body.trim(),
      })
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 },
      );
    }

    // ── Notificación por email (fire-and-forget, no bloquea la respuesta) ──
    try {
      // Obtener datos de la solicitud para el email
      const { data: req } = await supabase
        .from("certificate_requests")
        .select("reference_code, property_address, created_by, organization_id")
        .eq("id", requestId)
        .single();

      if (req) {
        const authorName =
          (await supabase.from("profiles").select("full_name").eq("id", user.id).single())
            .data?.full_name ?? (profile.role === "admin" ? "Soltegra" : "Cliente");

        // Email del cliente propietario (via auth.admin)
        let clientEmail = "";
        if (req.created_by) {
          const adminClient = createSupabaseAdminClient();
          const { data: authUser } = await adminClient.auth.admin.getUserById(req.created_by);
          clientEmail = authUser?.user?.email ?? "";
        }

        await sendNuevoMensaje({
          authorRole: profile.role as "admin" | "client",
          authorName,
          messageBody: body.trim(),
          referenceCode: req.reference_code ?? requestId,
          propertyAddress: req.property_address ?? "",
          requestId,
          clientEmail,
        });
      }
    } catch {
      // El fallo del email nunca bloquea el envío del mensaje
    }

    return NextResponse.json({ ok: true, id: data.id, createdAt: data.created_at });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
