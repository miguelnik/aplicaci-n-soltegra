"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Save,
  Send,
  Loader2,
  Sparkles,
  FileText,
  AlertCircle,
} from "lucide-react";
import { updateKnowledgeBase } from "@/lib/ai/actions";
import { useAiStream } from "@/hooks/useAiStream";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  initialContent: string;
  updatedAt: string | null;
  hasApiKey: boolean;
}

export function KnowledgeBaseEditor({ initialContent, updatedAt, hasApiKey }: Props) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [savePending, startSaveTransition] = useTransition();
  const [chatInput, setChatInput] = useState("");
  const { messages, isStreaming, error, sendMessage, clearMessages } = useAiStream();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "editor">("chat");

  // Auto-scroll al final del chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cuando la IA actualiza el KB via streaming, refrescar el contenido
  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      // Refrescar para obtener el KB actualizado
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  function handleSendChat() {
    if (!chatInput.trim() || isStreaming) return;
    const msg = chatInput.trim();
    setChatInput("");
    sendMessage("/api/ai/kb-chat", { message: msg });
  }

  function handleSaveKB() {
    startSaveTransition(async () => {
      const res = await updateKnowledgeBase(content);
      if (!res.ok) {
        toast.error(res.error ?? "Error al guardar");
        return;
      }
      toast.success("Base de conocimiento actualizada");
      router.refresh();
    });
  }

  if (!hasApiKey) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Primero configura la clave API de OpenAI en{" "}
            <a href="/admin/ajustes/empresa" className="text-primary underline">
              Ajustes → Empresa
            </a>{" "}
            para poder usar la IA.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Chat con IA ──────────────────────────────────────────────────── */}
      <Card className="flex flex-col lg:row-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-accent" />
            Chat con la IA
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cuéntale información sobre tu empresa y ella construirá la base de conocimiento.
          </p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          {/* Mensajes */}
          <div className="flex-1 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3"
               style={{ maxHeight: "420px", minHeight: "250px" }}>
            {messages.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Empieza contándole a la IA sobre tu empresa: qué servicios ofrecéis,
                en qué zonas trabajáis, qué os diferencia…
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border"
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
          <div className="mt-3 flex gap-2">
            <Textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ej: Hacemos instalaciones fotovoltaicas residenciales y comerciales en Granada…"
              rows={2}
              className="resize-none text-sm"
              disabled={isStreaming}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleSendChat}
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
        </CardContent>
      </Card>

      {/* ── Editor de documento ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Documento de conocimiento
            </CardTitle>
            {updatedAt && (
              <Badge variant="outline" className="text-[10px]">
                Actualizado{" "}
                {formatDistanceToNow(parseISO(updatedAt), {
                  addSuffix: true,
                  locale: es,
                })}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Puedes editar manualmente el documento que la IA ha generado.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
            className="resize-y font-mono text-xs"
            disabled={savePending}
            placeholder="La base de conocimiento está vacía. Usa el chat de la izquierda para empezar a construirla."
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {content.length.toLocaleString()} caracteres
            </p>
            <Button
              size="sm"
              onClick={handleSaveKB}
              disabled={savePending || content === initialContent}
            >
              <Save className="h-4 w-4" />
              {savePending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
