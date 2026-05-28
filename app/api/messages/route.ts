import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendNuevoMensaje } from "@/lib/email/send";

const BodySchema = z.object({
  requestId: z.string().uuid(),
  body: z.string().min(1).max(10000),
});

// Cache en proceso para evitar pegarle a auth.admin.getUserById en cada mensaje.
// TTL corto: si el cliente cambia de email no tardamos en propagarlo.
const USER_EMAIL_TTL_MS = 5 * 60 * 1000; // 5 min
const userEmailCache = new Map<string, { email: string; expires: number }>();

async function getCachedUserEmail(userId: string): Promise<string> {
  const cached = userEmailCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.email;

  const adminClient = createSupabaseAdminClient();
  const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
  const email = authUser?.user?.email ?? "";
  userEmailCache.set(userId, { email, expires: Date.now() + USER_EMAIL_TTL_MS });
  return email;
}

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
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }
    const { requestId, body } = parsed.data;

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

    // Normalizar superadmin a "admin" para la columna author_role
    const authorRole = profile.role === "superadmin" ? "admin" : profile.role;

    const { data, error } = await supabase
      .from("request_messages")
      .insert({
        request_id: requestId,
        author_id: user.id,
        author_role: authorRole,
        body: body.trim(),
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[messages] insert error", error);
      return NextResponse.json(
        { ok: false, error: "No se pudo enviar el mensaje" },
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
            .data?.full_name ?? (authorRole === "admin" ? "Soltegra" : "Cliente");

        // Email del cliente propietario (cache 5 min para evitar round-trip por mensaje)
        const clientEmail = req.created_by ? await getCachedUserEmail(req.created_by) : "";

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
    console.error("[messages]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
