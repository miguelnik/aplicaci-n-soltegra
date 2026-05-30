"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Send,
  Loader2,
  Globe,
  User,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { useAiStream } from "@/hooks/useAiStream";

interface Props {
  opportunityId?: string | null;
  organizationId?: string | null;
  initialContext?: string;
  initialWebsite?: string;
  hasApiKey: boolean;
}

export function ClientIntelligencePanel({
  opportunityId,
  organizationId,
  initialContext = "",
  initialWebsite = "",
  hasApiKey,
}: Props) {
  const [clientContext, setClientContext] = useState(initialContext);
  const [clientWebsite, setClientWebsite] = useState(initialWebsite);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const { messages, isStreaming, error, sendMessage, clearMessages } = useAiStream();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleAnalyze() {
    if (!clientContext.trim() || isStreaming) return;
    clearMessages();
    setHasAnalyzed(true);
    setAnalysisId(null);

    sendMessage("/api/ai/client-intel", {
      opportunityId: opportunityId ?? null,
      organizationId: organizationId ?? null,
      clientContext: clientContext.trim(),
      clientWebsite: clientWebsite.trim() || null,
    });
  }

  function handleFollowUp() {
    if (!followUpInput.trim() || isStreaming) return;
    const msg = followUpInput.trim();
    setFollowUpInput("");

    sendMessage("/api/ai/client-intel", {
      opportunityId: opportunityId ?? null,
      organizationId: organizationId ?? null,
      clientContext: clientContext.trim(),
      clientWebsite: clientWebsite.trim() || null,
      message: msg,
      analysisId,
    });
  }

  function handleNewAnalysis() {
    clearMessages();
    setHasAnalyzed(false);
    setAnalysisId(null);
  }

  if (!hasApiKey) {
    return null; // No mostrar el panel si no hay API key
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-accent" />
          Asistente de ventas IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contexto del cliente */}
        {!hasAnalyzed && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Describe al cliente y la IA te recomendará servicios y estrategia de
              acercamiento.
            </p>

            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs">
                <User className="h-3 w-3" />
                Contexto del cliente
              </Label>
              <Textarea
                value={clientContext}
                onChange={(e) => setClientContext(e.target.value)}
                placeholder="Ej: Empresa constructora de viviendas unifamiliares en la costa de Granada. Tienen varios proyectos en marcha y necesitan certificados energéticos para las licencias…"
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs">
                <Globe className="h-3 w-3" />
                Web del cliente (opcional)
              </Label>
              <Input
                value={clientWebsite}
                onChange={(e) => setClientWebsite(e.target.value)}
                placeholder="https://www.empresa-cliente.com"
                type="url"
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                La IA extraerá información de la web para personalizar su análisis.
              </p>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!clientContext.trim() || isStreaming}
              size="sm"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analizar con IA
            </Button>
          </div>
        )}

        {/* Resultados + chat */}
        {hasAnalyzed && (
          <div className="space-y-3">
            <div
              className="max-h-[400px] space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3"
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border"
                    }`}
                  >
                    {msg.content || (isStreaming && i === messages.length - 1 ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Analizando…
                      </span>
                    ) : null)}
                  </div>
                </div>
              ))}
              {error && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Follow-up */}
            <div className="flex gap-2">
              <Textarea
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                placeholder="Pregunta de seguimiento… Ej: ¿Cómo debería presentar el servicio de fotovoltaica?"
                rows={2}
                className="resize-none text-sm"
                disabled={isStreaming}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleFollowUp();
                  }
                }}
              />
              <Button
                size="icon"
                onClick={handleFollowUp}
                disabled={!followUpInput.trim() || isStreaming}
                className="shrink-0 self-end"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={handleNewAnalysis}>
              <RotateCcw className="h-3.5 w-3.5" />
              Nuevo análisis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
