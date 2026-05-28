import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  response: z.string().max(5000).optional().default(""),
  status: z.enum(["approved", "rejected", "deferred"]),
});

// POST /api/client/decisions/[id]/respond
// Permite al cliente responder a una decisión pendiente.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Verificar sesión
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Obtener perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "client") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  // Parsear body
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const response = parsed.data.response.trim();
  const decisionStatus = parsed.data.status;

  // Verificar que la decisión existe, pertenece a la organización del cliente,
  // es visible al cliente y está pendiente
  const { data: decision } = await supabase
    .from("expedition_decisions")
    .select("id, status, is_visible_to_client, request_id")
    .eq("id", id)
    .single();

  if (!decision) {
    return NextResponse.json({ error: "Decisión no encontrada" }, { status: 404 });
  }

  if (!decision.is_visible_to_client) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  // Verificar que la solicitud pertenece a la organización del cliente
  const { data: reqRow } = await supabase
    .from("certificate_requests")
    .select("id, organization_id")
    .eq("id", decision.request_id)
    .eq("organization_id", profile.organization_id!)
    .single();

  if (!reqRow) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  if (decision.status !== "pending") {
    return NextResponse.json(
      { error: "Esta decisión ya no está pendiente de respuesta" },
      { status: 409 },
    );
  }

  // Actualizar la decisión con service role después de validar sesión,
  // rol, visibilidad, pertenencia a la organización y estado actual.
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("expedition_decisions")
    .update({
      status: decisionStatus,
      client_response: response || null,
      client_responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    console.error("Error updating decision:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
