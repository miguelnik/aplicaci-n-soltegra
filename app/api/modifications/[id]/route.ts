// PATCH /api/modifications/[id]
// Actualiza campos editables de una modificación (cost, title, description).
// Solo mientras esté pendiente (no aprobada ni rechazada).
// Pueden editar el creador o el admin.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface Params {
  params: Promise<{ id: string }>;
}

const PatchSchema = z.object({
  cost: z.number().finite().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

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
    const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }
    const body = parsed.data;

    // Solo se actualizan los campos que vengan en el body
    const patch: Record<string, unknown> = {};
    if ("cost"        in body) patch.cost        = body.cost ?? null;
    if ("title"       in body) patch.title       = body.title?.trim();
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
      console.error("[modifications PATCH]", dbError);
      return NextResponse.json(
        { ok: false, error: "Error al actualizar" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[modifications PATCH]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
