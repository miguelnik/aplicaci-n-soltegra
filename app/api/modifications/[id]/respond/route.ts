// POST /api/modifications/[id]/respond
// Aprueba o rechaza una modificación.
// Solo puede responder quien NO la creó (rol opuesto al solicitante).

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface Params {
  params: Promise<{ id: string }>;
}

const BodySchema = z.object({
  action: z.enum(["approved", "rejected"]),
});

export async function POST(request: Request, { params }: Params) {
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

    // ── Validar acción ─────────────────────────────────────────────────────
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }
    const { action } = parsed.data;

    // ── Lookups con service role (evita bloqueos de RLS) ──────────────────
    const admin = createSupabaseAdminClient();

    const { data: mod } = await admin
      .from("expedition_decisions")
      .select("id, request_id, status, requested_by_role")
      .eq("id", id)
      .single();

    if (!mod) {
      return NextResponse.json({ ok: false, error: "Modificación no encontrada" }, { status: 404 });
    }

    if (mod.status !== "pending") {
      return NextResponse.json(
        { ok: false, error: "Esta modificación ya ha sido resuelta" },
        { status: 409 },
      );
    }

    const { data: req } = await admin
      .from("certificate_requests")
      .select("id, organization_id")
      .eq("id", mod.request_id)
      .single();

    if (!req) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }

    // ── Autorización manual ────────────────────────────────────────────────
    const isAdmin = profile.role === "admin" || profile.role === "superadmin";
    const currentRole: "admin" | "client" = isAdmin ? "admin" : "client";

    if (!isAdmin && req.organization_id !== profile.organization_id) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    // Solo puede responder quien NO la creó
    const requesterRole = mod.requested_by_role ?? "admin";
    if (currentRole === requesterRole) {
      return NextResponse.json(
        { ok: false, error: "No puedes responder a tu propia solicitud de modificación" },
        { status: 403 },
      );
    }

    // ── Actualizar estado ──────────────────────────────────────────────────
    const now = new Date().toISOString();
    const updatePayload =
      action === "approved"
        ? { status: "approved", approved_at: now, approved_by_id: user.id }
        : { status: "rejected", rejected_at: now, rejected_by_id: user.id };

    const { error: dbError } = await admin
      .from("expedition_decisions")
      .update(updatePayload)
      .eq("id", id);

    if (dbError) {
      console.error("[modifications/respond]", dbError);
      return NextResponse.json(
        { ok: false, error: "Error al actualizar" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[modifications/respond]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
