"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Loader2,
  Plus,
  Trash2,
  MessageSquare,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useAiStream } from "@/hooks/useAiStream";
import { createConversation, deleteConversation, listConversations } from "@/lib/ai/actions";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface Props {
  /** URL del endpoint de streaming */
  endpoint: string;
  /** Si hay API key configurada */
  hasApiKey: boolean;
  /** Placeholder del input */
  placeholder?: string;
}

export function AiChat({ endpoint, hasApiKey, placeholder }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const { messages, isStreaming, error, sendMessage, clearMessages, setMessages } = useAiStream();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cargar conversaciones
  const loadConversations = useCallback(async () => {
    try {
      const convs = await listConversations();
      setConversations(convs);
    } catch {
      // silenciar
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Cargar mensajes de una conversación
  async function selectConversation(id: string) {
    setActiveConvId(id);
    clearMessages();

    try {
      const res = await fetch(`/api/ai/chat/history?conversationId=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setMessages(
            data.messages.map((m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          );
        }
      }
    } catch {
      // silenciar
    }
  }

  async function handleNewConversation() {
    const res = await createConversation();
    if (!res.ok || !res.id) {
      toast.error(res.error ?? "Error al crear conversación");
      return;
    }
    setActiveConvId(res.id);
    clearMessages();
    await loadConversations();
  }

  async function handleDeleteConversation(id: string) {
    const res = await deleteConversation(id);
    if (!res.ok) {
      toast.error(res.error ?? "Error");
      return;
    }
    if (activeConvId === id) {
      setActiveConvId(null);
      clearMessages();
    }
    await loadConversations();
  }

  function handleSend() {
    if (!chatInput.trim() || isStreaming || !activeConvId) return;
    const msg = chatInput.trim();
    setChatInput("");
    sendMessage(endpoint, { conversationId: activeConvId, message: msg });
  }

  if (!hasApiKey) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-muted/20 p-8">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            El asistente de IA no está disponible. Contacta al superadministrador
            para configurar la clave API de OpenAI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
      {/* ── Sidebar: conversaciones ────────────────────────────────────── */}
      <div className="hidden w-64 shrink-0 flex-col rounded-md border bg-card md:flex">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Conversaciones</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNewConversation}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Sin conversaciones. Crea una nueva.
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex cursor-pointer items-start gap-2 border-b px-3 py-2 transition-colors hover:bg-muted/50",
                  activeConvId === conv.id && "bg-muted/60",
                )}
                onClick={() => selectConversation(conv.id)}
              >
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {conv.title || "Nueva conversación"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(parseISO(conv.updatedAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Chat principal ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col rounded-md border bg-card">
        {!activeConvId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            <Sparkles className="h-10 w-10 text-accent" />
            <p className="text-sm text-muted-foreground text-center">
              Selecciona una conversación o crea una nueva para empezar.
            </p>
            <Button variant="outline" size="sm" onClick={handleNewConversation}>
              <Plus className="h-4 w-4" />
              Nueva conversación
            </Button>
            {/* Botón para móvil */}
            <div className="mt-2 md:hidden">
              {conversations.length > 0 && (
                <div className="space-y-1">
                  {conversations.slice(0, 5).map((conv) => (
                    <Button
                      key={conv.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => selectConversation(conv.id)}
                    >
                      <MessageSquare className="h-3 w-3" />
                      {conv.title || "Sin título"}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mensajes */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <p className="py-12 text-center text-xs text-muted-foreground">
                  Escribe tu primera pregunta al asistente comercial.
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 border"
                    }`}
                  >
                    {msg.content || (isStreaming && i === messages.length - 1 ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Pensando…
                      </span>
                    ) : null)}
                  </div>
                </div>
              ))}
              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-3">
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={placeholder ?? "Pregunta sobre servicios, capacidades, tipos de proyecto…"}
                  rows={2}
                  className="resize-none text-sm"
                  disabled={isStreaming}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!chatInput.trim() || isStreaming}
                  className="shrink-0 self-end"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Ctrl+Enter para enviar
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
