// GET /api/ai/chat/history?conversationId=xxx
// Devuelve el historial de mensajes de una conversación.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "Falta conversationId" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Verificar que la conversación pertenece al usuario
  const { data: conv } = await admin
    .from("ai_chat_conversations")
    .select("user_id")
    .eq("id", conversationId)
    .single();

  if (!conv || conv.user_id !== user.id) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const { data: messages } = await admin
    .from("ai_chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    messages: (messages ?? [])
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content })),
  });
}
