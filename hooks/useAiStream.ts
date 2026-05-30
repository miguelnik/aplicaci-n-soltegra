"use client";

// ============================================================================
// Hook para consumir SSE streaming desde los endpoints de IA.
// ============================================================================

import { useState, useCallback, useRef } from "react";

interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

interface UseAiStreamReturn {
  /** Lista de mensajes (user + assistant) */
  messages: AiMessage[];
  /** True mientras el stream está activo */
  isStreaming: boolean;
  /** Error (si lo hay) */
  error: string | null;
  /** Enviar un mensaje al endpoint de IA */
  sendMessage: (url: string, body: Record<string, unknown>) => Promise<void>;
  /** Limpiar los mensajes */
  clearMessages: () => void;
  /** Establecer mensajes (para cargar historial) */
  setMessages: (msgs: AiMessage[]) => void;
}

export function useAiStream(): UseAiStreamReturn {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (url: string, body: Record<string, unknown>) => {
    setError(null);
    setIsStreaming(true);

    // Añadir el mensaje del usuario
    const userContent = (body.message as string) ?? "";
    setMessages((prev) => [...prev, { role: "user", content: userContent }]);

    // Preparar placeholder del assistant
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error ?? `Error HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No se pudo iniciar el streaming");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Procesar líneas SSE completas
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Mantener la línea incompleta

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const payload = trimmed.slice(6); // "data: " = 6 chars
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as {
              content?: string;
              error?: string;
            };

            if (parsed.error) {
              setError(parsed.error);
              continue;
            }

            if (parsed.content) {
              // Actualizar el último mensaje (assistant)
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.content,
                  };
                }
                return updated;
              });
            }
          } catch {
            // JSON inválido — ignorar
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Stream cancelado por el usuario
      } else {
        const msg = err instanceof Error ? err.message : "Error de conexión";
        setError(msg);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    setMessages,
  };
}
