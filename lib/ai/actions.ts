"use server";

// ============================================================================
// Server actions del módulo de IA.
// ============================================================================

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isNextControlFlowError } from "@/lib/utils";
import { encrypt } from "./crypto";
import { AI_MODELS } from "./types";
import type { AiModelValue } from "./types";

// ── Configuración de OpenAI ─────────────────────────────────────────────────

export interface UpdateAiSettingsInput {
  apiKey?: string; // solo si se cambia
  model: string;
}

export async function updateAiSettings(
  input: UpdateAiSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
    const admin = createSupabaseAdminClient();

    // Validar modelo
    const validModels = AI_MODELS.map((m) => m.value);
    if (!validModels.includes(input.model as AiModelValue)) {
      return { ok: false, error: "Modelo no válido" };
    }

    const { data: existing } = await admin
      .from("company_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!existing) return { ok: false, error: "No hay configuración de empresa" };

    const payload: Record<string, unknown> = {
      openai_model: input.model,
    };

    // Solo actualizar la key si se proporciona una nueva
    if (input.apiKey && input.apiKey.trim()) {
      payload.openai_api_key_encrypted = encrypt(input.apiKey.trim());
    }

    const { error } = await admin
      .from("company_settings")
      .update(payload)
      .eq("id", existing.id);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/ajustes/empresa");
    return { ok: true };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function testAiConnection(): Promise<{
  ok: boolean;
  error?: string;
  model?: string;
}> {
  try {
    await requireSuperAdmin();

    // Importar dinámicamente para evitar problemas con server-only en server actions
    const { getAiClientAndModel } = await import("./openai");
    const ai = await getAiClientAndModel();
    if (!ai) return { ok: false, error: "No hay API key configurada" };

    const response = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [{ role: "user", content: "Di 'OK' y nada más." }],
      max_tokens: 5,
    });

    const reply = response.choices[0]?.message?.content?.trim();
    if (!reply) return { ok: false, error: "La API no devolvió respuesta" };

    return { ok: true, model: ai.model };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    // Limpiar mensajes de error de OpenAI para el usuario
    if (msg.includes("Incorrect API key")) {
      return { ok: false, error: "La API key es incorrecta" };
    }
    if (msg.includes("insufficient_quota")) {
      return { ok: false, error: "Sin créditos en la cuenta de OpenAI" };
    }
    return { ok: false, error: `Error de conexión: ${msg}` };
  }
}

// ── Base de conocimiento ────────────────────────────────────────────────────

export async function getKnowledgeBase(): Promise<{
  content: string;
  updatedAt: string | null;
}> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("ai_knowledge_base")
    .select("content, updated_at")
    .limit(1)
    .maybeSingle();

  return {
    content: data?.content ?? "",
    updatedAt: data?.updated_at ?? null,
  };
}

export async function updateKnowledgeBase(
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
    const admin = createSupabaseAdminClient();
    const me = await requireSuperAdmin();

    const { data: existing } = await admin
      .from("ai_knowledge_base")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!existing) {
      return { ok: false, error: "No hay base de conocimiento inicializada" };
    }

    const { error } = await admin
      .from("ai_knowledge_base")
      .update({ content, updated_by: me.id })
      .eq("id", existing.id);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/ajustes/ia");
    return { ok: true };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Conversaciones del asistente comercial ──────────────────────────────────

export async function listConversations(): Promise<
  Array<{ id: string; title: string | null; updatedAt: string }>
> {
  const me = await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("ai_chat_conversations")
    .select("id, title, updated_at")
    .eq("user_id", me.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updated_at,
  }));
}

export async function createConversation(): Promise<{
  ok: boolean;
  id?: string;
  error?: string;
}> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from("ai_chat_conversations")
      .insert({ user_id: me.id, title: null })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteConversation(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    // Verificar que la conversación pertenece al usuario
    const { data: conv } = await admin
      .from("ai_chat_conversations")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!conv) return { ok: false, error: "Conversación no encontrada" };
    if (conv.user_id !== me.id) return { ok: false, error: "No autorizado" };

    const { error } = await admin
      .from("ai_chat_conversations")
      .delete()
      .eq("id", id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
