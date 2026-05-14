// PATCH /api/modifications/[id]
// Actualiza campos editables de una modificación (cost, title, description).
// Solo mientras esté pendiente (no aprobada ni rechazada).
// Pueden editar el creador o el admin.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    // ── Autenticación ──────────────────────────────────────────────────────
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

    // ── Cuerpo ────────────────────────────────────────────────────────────
    const body = await request.json() as {
      cost?: number | null;
      title?: string;
      description?: string | null;
    };

    // Solo se actualizan los campos que vengan en el body
    const patch: Record<string, unknown> = {};
    if ("cost"        in body) patch.cost        = body.cost ?? null;
    if ("title"       in body) patch.title       = (body.title ?? "").trim() || undefined;
    if ("description" in body) patch.description = body.description?.trim() || null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Sin campos a actualizar" }, { status: 400 });
    }
    if ("title" in patch && !patch.title) {
      return NextResponse.json({ ok: false, error: "El título no puede estar vacío" }, { status: 400 });
    }

    // ── Lookup con service role ────────────────────────────────────────────
    const admin = createSupabaseAdminClient();

    const { data: mod } = await admin
      .from("expedition_decisions")
      .select("id, request_id, status, requested_by_id, requested_by_role")
      .eq("id", id)
      .single();

    if (!mod) {
      return NextResponse.json({ ok: false, error: "Modificación no encontrada" }, { status: 404 });
    }

    if (mod.status !== "pending") {
      return NextResponse.json(
        { ok: false, error: "Solo se pueden editar modificaciones pendientes" },
        { status: 409 },
      );
    }

    // ── Autorización ──────────────────────────────────────────────────────
    const { data: req } = await admin
      .from("certificate_requests")
      .select("id, organization_id")
      .eq("id", mod.request_id)
      .single();

    if (!req) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }

    const isAdmin = profile.role === "admin" || profile.role === "superadmin";
    if (!isAdmin && req.organization_id !== profile.organization_id) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    // ── Actualizar ─────────────────────────────────────────────────────────
    const { error: dbError } = await admin
      .from("expedition_decisions")
      .update(patch)
      .eq("id", id);

    if (dbError) {
      return NextResponse.json(
        { ok: false, error: "Error al actualizar: " + dbError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
