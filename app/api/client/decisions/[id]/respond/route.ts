import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// POST /api/client/decisions/[id]/respond
// Permite al cliente responder a una decisión pendiente.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

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
  const body = await req.json().catch(() => null);
  const response = (body?.response ?? "").trim();
  const decisionStatus = body?.status as string | undefined;
  const validStatuses = ["approved", "rejected", "deferred"];

  if (!validStatuses.includes(decisionStatus ?? "")) {
    return NextResponse.json({ error: "Selecciona aprobar, rechazar o aplazar" }, { status: 400 });
  }

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

  // Actualizar la decisión
  const { error } = await supabase
    .from("expedition_decisions")
    .update({
      status: decisionStatus,
      client_response: response,
      client_responded_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating decision:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
