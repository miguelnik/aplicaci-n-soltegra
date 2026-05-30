// POST /api/ai/chat
// SSE streaming para el asistente comercial del CRM.
// Accesible para todos los admins.

import { z } from "zod";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAiClientAndModel, createAiStream } from "@/lib/ai/openai";
import { commercialAssistantPrompt } from "@/lib/ai/prompts";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(10000),
});

export async function POST(request: Request) {
  // ── Auth: cualquier admin ──────────────────────────────────────────────
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

  // ── Validar body ───────────────────────────────────────────────────────
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { conversationId, message } = parsed.data;

  // ── OpenAI client ──────────────────────────────────────────────────────
  const ai = await getAiClientAndModel();
  if (!ai) {
    return NextResponse.json(
      { error: "No hay API key de OpenAI configurada. Contacta al superadministrador." },
      { status: 400 },
    );
  }

  // ── Cargar contexto ────────────────────────────────────────────────────
  const admin = createSupabaseAdminClient();

  // Verificar que la conversación pertenece al usuario
  const { data: conv } = await admin
    .from("ai_chat_conversations")
    .select("id, user_id")
    .eq("id", conversationId)
    .single();

  if (!conv || conv.user_id !== user.id) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  // KB
  const { data: kb } = await admin
    .from("ai_knowledge_base")
    .select("id, content")
    .limit(1)
    .maybeSingle();

  // Company name
  const { data: company } = await admin
    .from("company_settings")
    .select("legal_name")
    .limit(1)
    .maybeSingle();

  // Servicios
  const { data: services } = await admin
    .from("service_types")
    .select("name, description")
    .order("name");

  const servicesCatalog = (services ?? [])
    .map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ""}`)
    .join("\n");

  // Historial de la conversación (últimos 30 mensajes)
  const { data: history } = await admin
    .from("ai_chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(30);

  // ── Construir mensajes ─────────────────────────────────────────────────
  const companyName = company?.legal_name ?? "la empresa";
  const kbContent = kb?.content ?? "";

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: commercialAssistantPrompt(companyName, kbContent, servicesCatalog) },
    ...(history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  // ── Guardar mensaje del usuario en DB ──────────────────────────────────
  await admin.from("ai_chat_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });

  // Actualizar título de la conversación si es el primer mensaje
  if (!history || history.length === 0) {
    const title = message.slice(0, 60) + (message.length > 60 ? "…" : "");
    await admin
      .from("ai_chat_conversations")
      .update({ title })
      .eq("id", conversationId);
  }

  // Actualizar updated_at de la conversación
  await admin
    .from("ai_chat_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // ── Stream + guardar respuesta + auto-KB ───────────────────────────────
  return createAiStream({
    messages,
    client: ai.client,
    model: ai.model,
    onComplete: async (fullResponse) => {
      // Guardar respuesta del asistente
      await admin.from("ai_chat_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: fullResponse,
      });

      // Auto-actualización del KB
      if (kb?.id) {
        const kbUpdateRegex = /\[KB_UPDATE\]([\s\S]*?)\[\/KB_UPDATE\]/g;
        const updates: string[] = [];
        let match;
        while ((match = kbUpdateRegex.exec(fullResponse)) !== null) {
          updates.push(match[1].trim());
        }

        if (updates.length > 0) {
          let newContent = kb.content || "";
          for (const update of updates) {
            newContent += (newContent ? "\n\n" : "") + update;
          }
          await admin
            .from("ai_knowledge_base")
            .update({ content: newContent, updated_by: user.id })
            .eq("id", kb.id);
        }
      }
    },
  });
}
