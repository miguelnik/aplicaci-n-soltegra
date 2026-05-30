// POST /api/ai/kb-chat
// SSE streaming para el chat de configuración de la base de conocimiento.
// Solo superadmin.

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAiClientAndModel, createAiStream } from "@/lib/ai/openai";
import { knowledgeBaseConfigPrompt } from "@/lib/ai/prompts";
import { NextResponse } from "next/server";

const BodySchema = z.object({
  message: z.string().min(1).max(10000),
});

export async function POST(request: Request) {
  // ── Auth: solo superadmin ──────────────────────────────────────────────
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

  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // ── Validar body ───────────────────────────────────────────────────────
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // ── OpenAI client ──────────────────────────────────────────────────────
  const ai = await getAiClientAndModel();
  if (!ai) {
    return NextResponse.json(
      { error: "No hay API key de OpenAI configurada. Ve a Ajustes → Empresa → IA." },
      { status: 400 },
    );
  }

  // ── Cargar contexto ────────────────────────────────────────────────────
  const admin = createSupabaseAdminClient();

  const { data: kb } = await admin
    .from("ai_knowledge_base")
    .select("id, content")
    .limit(1)
    .maybeSingle();

  const { data: company } = await admin
    .from("company_settings")
    .select("legal_name")
    .limit(1)
    .maybeSingle();

  const companyName = company?.legal_name ?? "la empresa";
  const currentKB = kb?.content ?? "";

  // ── Construir mensajes ─────────────────────────────────────────────────
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: knowledgeBaseConfigPrompt(companyName, currentKB) },
    { role: "user", content: parsed.data.message },
  ];

  // ── Stream + auto-actualizar KB ────────────────────────────────────────
  return createAiStream({
    messages,
    client: ai.client,
    model: ai.model,
    onComplete: async (fullResponse) => {
      // Buscar tags [KB_UPDATE]...[/KB_UPDATE]
      const kbUpdateRegex = /\[KB_UPDATE\]([\s\S]*?)\[\/KB_UPDATE\]/g;
      const updates: string[] = [];
      let match;
      while ((match = kbUpdateRegex.exec(fullResponse)) !== null) {
        updates.push(match[1].trim());
      }

      if (updates.length === 0 || !kb?.id) return;

      // Integrar las actualizaciones en el KB existente
      let newContent = currentKB;
      for (const update of updates) {
        if (newContent) {
          newContent += "\n\n" + update;
        } else {
          newContent = update;
        }
      }

      // Guardar KB actualizado
      await admin
        .from("ai_knowledge_base")
        .update({ content: newContent, updated_by: user.id })
        .eq("id", kb.id);
    },
  });
}
