// POST /api/modifications/[id]/message
// Añade un mensaje al hilo de conversación de una modificación.
// Accesible para clientes (de la organización) y administradores.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface Params {
  params: Promise<{ id: string }>;
}

const BodySchema = z.object({
  requestId: z.string().uuid(),
  body: z.string().min(1).max(10000),
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

    // ── Cuerpo de la petición ──────────────────────────────────────────────
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }
    const { requestId, body: msgBody } = parsed.data;

    // ── Lookups con service role (evita bloqueos de RLS) ──────────────────
    const admin = createSupabaseAdminClient();

    const { data: mod } = await admin
      .from("expedition_decisions")
      .select("id, request_id")
      .eq("id", id)
      .eq("request_id", requestId)
      .single();

    if (!mod) {
      return NextResponse.json({ ok: false, error: "Modificación no encontrada" }, { status: 404 });
    }

    const { data: req } = await admin
      .from("certificate_requests")
      .select("id, organization_id")
      .eq("id", requestId)
      .single();

    if (!req) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }

    // ── Autorización manual ────────────────────────────────────────────────
    const isAdmin = profile.role === "admin" || profile.role === "superadmin";
    if (!isAdmin && req.organization_id !== profile.organization_id) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const authorRole: "admin" | "client" = isAdmin ? "admin" : "client";

    // ── Insertar mensaje ───────────────────────────────────────────────────
    const { error: dbError } = await admin.from("modification_messages").insert({
      modification_id: id,
      request_id: requestId,
      author_id: user.id,
      author_role: authorRole,
      body: msgBody.trim(),
    });

    if (dbError) {
      console.error("[modifications/message]", dbError);
      return NextResponse.json(
        { ok: false, error: "Error al enviar mensaje" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[modifications/message]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
