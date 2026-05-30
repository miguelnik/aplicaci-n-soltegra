import "server-only";

// ============================================================================
// Helper server-side para obtener el cliente de OpenAI configurado.
// Lee la API key encriptada de company_settings, la descifra, y devuelve
// una instancia de OpenAI lista para usar.
// ============================================================================

import OpenAI from "openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "./crypto";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * Lee la configuración de IA de company_settings.
 * Devuelve { apiKey (descifrada), model } o null si no hay key configurada.
 */
async function getAiConfig(): Promise<{ apiKey: string; model: string } | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("company_settings")
    .select("openai_api_key_encrypted, openai_model")
    .limit(1)
    .maybeSingle();

  if (!data?.openai_api_key_encrypted) return null;

  try {
    const apiKey = decrypt(data.openai_api_key_encrypted);
    return { apiKey, model: data.openai_model ?? "gpt-4o-mini" };
  } catch {
    console.error("[ai] Error al descifrar la API key de OpenAI");
    return null;
  }
}

/**
 * Devuelve una instancia de OpenAI configurada o null si no hay API key.
 */
export async function getOpenAIClient(): Promise<OpenAI | null> {
  const config = await getAiConfig();
  if (!config) return null;
  return new OpenAI({ apiKey: config.apiKey });
}

/**
 * Devuelve el modelo de OpenAI configurado.
 */
export async function getAiModel(): Promise<string> {
  const config = await getAiConfig();
  return config?.model ?? "gpt-4o-mini";
}

/**
 * Devuelve tanto el cliente como el modelo, o null si no hay API key.
 */
export async function getAiClientAndModel(): Promise<{
  client: OpenAI;
  model: string;
} | null> {
  const config = await getAiConfig();
  if (!config) return null;
  return {
    client: new OpenAI({ apiKey: config.apiKey }),
    model: config.model,
  };
}

// ── Helper de streaming SSE ─────────────────────────────────────────────────

interface StreamOptions {
  messages: ChatCompletionMessageParam[];
  client: OpenAI;
  model: string;
  /** Metadata enviada como primer evento SSE (ej: { analysisId }) */
  metadata?: Record<string, unknown>;
  /** Callback que recibe la respuesta completa al finalizar el stream */
  onComplete?: (fullResponse: string) => Promise<void>;
}

/**
 * Crea una Response con SSE streaming de una completación de OpenAI.
 * Si se pasa `metadata`, se envía como primer evento: `data: {"meta":{...}}\n\n`
 * Cada chunk de contenido: `data: {"content":"..."}\n\n`
 * Al finalizar: `data: [DONE]\n\n`
 */
export function createAiStream({ messages, client, model, metadata, onComplete }: StreamOptions): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      // Enviar metadata como primer evento si existe
      if (metadata) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ meta: metadata })}\n\n`),
        );
      }

      try {
        const completion = await client.chat.completions.create({
          model,
          messages,
          stream: true,
        });

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content ?? "";
          if (content) {
            fullResponse += content;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
            );
          }
        }

        // Señal de fin
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        // Ejecutar callback con la respuesta completa
        if (onComplete) {
          try {
            await onComplete(fullResponse);
          } catch (err) {
            console.error("[ai] Error en onComplete callback:", err);
          }
        }
      } catch (err) {
        console.error("[ai] Error en streaming:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Error del servicio de IA";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
