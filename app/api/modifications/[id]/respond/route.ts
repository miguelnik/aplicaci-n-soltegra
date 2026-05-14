// POST /api/modifications/[id]/respond
// Aprueba o rechaza una modificación.
// Solo puede responder quien NO la creó (rol opuesto al solicitante).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;

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
    const { action } = body as { action?: "approved" | "rejected" };

    if (!action || !["approved", "rejected"].includes(action)) {
      return NextResponse.json(
        { ok: false, error: "action debe ser 'approved' o 'rejected'" },
        { status: 400 },
      );
    }

    // Obtener la modificación
    const { data: mod } = await supabase
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

    // Verificar que el usuario tiene acceso a esta solicitud
    const { data: req } = await supabase
      .from("certificate_requests")
      .select("id, organization_id")
      .eq("id", mod.request_id)
      .single();

    if (!req) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }

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

    const now = new Date().toISOString();
    const admin = createSupabaseAdminClient();

    const updatePayload =
      action === "approved"
        ? { status: "approved", approved_at: now, approved_by_id: user.id }
        : { status: "rejected", rejected_at: now, rejected_by_id: user.id };

    const { error: dbError } = await admin
      .from("expedition_decisions")
      .update(updatePayload)
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
