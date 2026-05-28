// POST /api/modifications
// Crea una nueva solicitud de modificación.
// Accesible para clientes (de la organización) y administradores.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  requestId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).nullable().optional(),
  cost: z.number().finite().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Sin perfil" }, { status: 403 });
    }

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }
    const { requestId, title, description, cost } = parsed.data;

    // Verificar que la solicitud existe y el usuario tiene acceso
    // Usamos service role para evitar bloqueos de RLS
    const admin = createSupabaseAdminClient();
    const { data: req } = await admin
      .from("certificate_requests")
      .select("id, organization_id")
      .eq("id", requestId)
      .single();

    if (!req) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }

    const isAdmin = profile.role === "admin" || profile.role === "superadmin";
    if (!isAdmin && req.organization_id !== profile.organization_id) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const authorRole: "admin" | "client" = isAdmin ? "admin" : "client";
    const { data: inserted, error: dbError } = await admin
      .from("expedition_decisions")
      .insert({
        request_id: requestId,
        title: title.trim(),
        description: description?.trim() || null,
        status: "pending",
        is_visible_to_client: true,
        requested_by_id: user.id,
        requested_by_role: authorRole,
        cost: cost ?? null,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("[modifications]", dbError);
      return NextResponse.json(
        { ok: false, error: "Error al crear modificación" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    console.error("[modifications]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
