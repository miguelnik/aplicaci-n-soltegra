"use client";

// Módulo: Decisiones pendientes del cliente
// El cliente puede ver y responder a decisiones que requieren su confirmación.

import { useState } from "react";
import { AlertCircle, CheckCircle2, XCircle, Clock, MessageSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";
import type { DecisionStatus } from "@/lib/modules/expedition-types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
  currentRole: "client" | "admin";
}

const STATUS_CONFIG: Record<DecisionStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending:  { label: "Pendiente",  variant: "default" },
  approved: { label: "Aprobado",   variant: "secondary" },
  rejected: { label: "Rechazado",  variant: "destructive" },
  deferred: { label: "Aplazado",   variant: "outline" },
};

function DecisionCard({
  decision,
  canRespond,
  requestId,
}: {
  decision: Props["data"]["decisions"][number];
  canRespond: boolean;
  requestId: string;
}) {
  const [responding, setResponding] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const cfg = STATUS_CONFIG[decision.status] ?? STATUS_CONFIG.pending;

  async function submitResponse() {
    if (!responseText.trim()) {
      toast.error("Escribe tu respuesta antes de enviar");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/client/decisions/${decision.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: responseText.trim() }),
      });
      if (!res.ok) throw new Error("Error al enviar la respuesta");
      toast.success("Respuesta enviada correctamente");
      setResponding(false);
      // Refresh to show updated data
      window.location.reload();
    } catch {
      toast.error("No se pudo enviar la respuesta. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {decision.status === "pending" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
          ) : decision.status === "approved" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          ) : decision.status === "rejected" ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <p className="font-medium leading-tight">{decision.title}</p>
        </div>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>

      {decision.description && (
        <p className="mt-2 text-sm text-muted-foreground">{decision.description}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {decision.deadline && (
          <span>
            Plazo:{" "}
            <strong className="text-orange-600">
              {format(parseISO(decision.deadline), "d MMM yyyy", { locale: es })}
            </strong>
          </span>
        )}
        {decision.client_responded_at && (
          <span>
            Respondido el{" "}
            {format(parseISO(decision.client_responded_at), "d MMM yyyy", { locale: es })}
          </span>
        )}
      </div>

      {/* Respuesta existente del cliente */}
      {decision.client_response && (
        <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            Tu respuesta
          </div>
          <p>{decision.client_response}</p>
        </div>
      )}

      {/* Formulario de respuesta */}
      {canRespond && decision.status === "pending" && !decision.client_response && (
        <div className="mt-3">
          {!responding ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setResponding(true)}
            >
              Responder
            </Button>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Escribe tu respuesta o confirmación..."
                rows={3}
                disabled={submitting}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={submitResponse} disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar respuesta"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setResponding(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function PendingDecisionsModule({ module: mod, data, currentRole }: Props) {
  const { decisions, req } = data;
  const canRespond = currentRole === "client";

  return (
    <section aria-labelledby="decisions-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="decisions-heading" className="text-lg font-semibold">
          {mod.label}
        </h2>
        {decisions && decisions.some((d) => d.status === "pending") && (
          <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
            {(decisions ?? []).filter((d) => d.status === "pending").length} pendiente
            {(decisions ?? []).filter((d) => d.status === "pending").length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      {(!decisions || decisions.length === 0) && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No hay decisiones pendientes en este momento.
        </p>
      )}
      <ul className="space-y-3">
        {(decisions ?? []).map((d) => (
          <DecisionCard
            key={d.id}
            decision={d}
            canRespond={canRespond}
            requestId={req.id}
          />
        ))}
      </ul>
    </section>
  );
}
