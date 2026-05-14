// POST /api/modifications/[id]/message
// Añade un mensaje al hilo de conversación de una modificación.
// Accesible para clientes (de la organización) y administradores.

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
    const { requestId, body: msgBody } = body as {
      requestId?: string;
      body?: string;
    };

    if (!requestId || !msgBody?.trim()) {
      return NextResponse.json(
        { ok: false, error: "requestId y body son obligatorios" },
        { status: 400 },
      );
    }

    // Verificar que la modificación existe y pertenece a la solicitud
    const { data: mod } = await supabase
      .from("expedition_decisions")
      .select("id, request_id")
      .eq("id", id)
      .eq("request_id", requestId)
      .single();

    if (!mod) {
      return NextResponse.json({ ok: false, error: "Modificación no encontrada" }, { status: 404 });
    }

    // Verificar acceso a la solicitud
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
    const { error: dbError } = await admin.from("modification_messages").insert({
      modification_id: id,
      request_id: requestId,
      author_id: user.id,
      author_role: authorRole,
      body: msgBody.trim(),
    });

    if (dbError) {
      return NextResponse.json(
        { ok: false, error: "Error al enviar mensaje: " + dbError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
