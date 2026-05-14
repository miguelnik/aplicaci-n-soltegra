// POST /api/modifications
// Crea una nueva solicitud de modificación.
// Accesible para clientes (de la organización) y administradores.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

    const body = await request.json();
    const { requestId, title, description, cost } = body as {
      requestId?: string;
      title?: string;
      description?: string | null;
      cost?: number | null;
    };

    if (!requestId || !title?.trim()) {
      return NextResponse.json(
        { ok: false, error: "requestId y title son obligatorios" },
        { status: 400 },
      );
    }

    // Verificar que la solicitud existe y el usuario tiene acceso
    const { data: req } = await supabase
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

    const admin = createSupabaseAdminClient();
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
      return NextResponse.json(
        { ok: false, error: "Error al crear modificación: " + dbError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
