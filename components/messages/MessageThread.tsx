"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface ThreadMessage {
  id: string;
  body: string;
  authorRole: "admin" | "client";
  authorName: string | null;
  createdAt: string;
}

interface Props {
  requestId: string;
  messages: ThreadMessage[];
  /** "admin" o "client" — para estilar la burbuja del usuario actual */
  currentRole: "admin" | "client";
  /** Si está deshabilitado, no se muestra el input para escribir */
  disabled?: boolean;
  /** Texto del placeholder del input */
  placeholder?: string;
  /** Título visible de la tarjeta */
  title?: string;
}

export function MessageThread({
  requestId,
  messages,
  currentRole,
  disabled,
  placeholder,
  title = "Mensajes",
}: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function send() {
    const trimmed = body.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, body: trimmed }),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(`Error: ${result.error}`);
        return;
      }
      setBody("");
      toast.success("Mensaje enviado");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4" />
          {title}
          {messages.length > 0 && (
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {messages.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            Aún no hay mensajes en esta conversación.
          </p>
        ) : (
          <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {messages.map((m) => {
              const mine = m.authorRole === currentRole;
              return (
                <li
                  key={m.id}
                  className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.body}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {m.authorRole === "admin" ? "Soltegra" : m.authorName ?? "Cliente"} ·{" "}
                    {format(new Date(m.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {!disabled && (
          <div className="space-y-2 border-t pt-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder={placeholder ?? "Escribe un mensaje..."}
              disabled={sending}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
                <Send className="h-3.5 w-3.5" />
                {sending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
