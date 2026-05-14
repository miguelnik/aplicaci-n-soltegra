"use client";

// Módulo: Modificaciones del proyecto
// Gestiona solicitudes de cambio tanto del cliente como del administrador.
// El que NO la crea es quien debe aprobarla o rechazarla.
// Una vez resuelta, queda bloqueada con fecha de solicitud y resolución.

import { useState } from "react";
import {
  CheckCircle2, XCircle, Clock, Plus, Send, Euro,
  User, Lock, ChevronDown, ChevronUp, Paperclip,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EntityAttachments } from "./EntityAttachments";
import { toast } from "sonner";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";
import type { ExpeditionDecision, ModificationMessage } from "@/lib/modules/expedition-types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
  currentRole: "client" | "admin";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isLocked(mod: ExpeditionDecision) {
  return mod.status === "approved" || mod.status === "rejected";
}

function canRespond(mod: ExpeditionDecision, currentRole: "client" | "admin") {
  if (isLocked(mod)) return false;
  // El que NO la creó puede responder
  if (mod.requested_by_role === "client") return currentRole === "admin";
  if (mod.requested_by_role === "admin")  return currentRole === "client";
  // Si no tiene rol asignado (legacy), solo admin responde
  return currentRole === "admin";
}

function requesterLabel(role: "client" | "admin" | null) {
  if (role === "client") return "Solicitado por el cliente";
  if (role === "admin")  return "Solicitado por Soltegra";
  return "Solicitado por el equipo";
}

// ── Tarjeta de modificación ───────────────────────────────────────────────────

function ModificationCard({
  mod,
  messages,
  photos,
  currentRole,
  requestId,
}: {
  mod: ExpeditionDecision;
  messages: ModificationMessage[];
  photos: ModulePageData["photos"];
  currentRole: "client" | "admin";
  requestId: string;
}) {
  const [open, setOpen] = useState(mod.status === "pending");
  const [responding, setResponding] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [respondingAction, setRespondingAction] = useState(false);

  const locked = isLocked(mod);
  const modPhotos = photos.filter(
    (p) => p.source_entity_type === "modification" && p.source_entity_id === mod.id,
  );

  async function submitRespond(action: "approved" | "rejected") {
    setRespondingAction(true);
    try {
      const res = await fetch(`/api/modifications/${mod.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Error al responder");
      toast.success(action === "approved" ? "Modificación aprobada" : "Modificación rechazada");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setRespondingAction(false);
    }
  }

  async function sendMessage() {
    const text = newMessage.trim();
    if (!text) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/modifications/${mod.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, body: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Error al enviar");
      setNewMessage("");
      toast.success("Mensaje enviado");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSendingMsg(false);
    }
  }

  const statusColor = locked
    ? mod.status === "approved"
      ? "text-green-600"
      : "text-destructive"
    : "text-orange-500";

  const StatusIcon = locked
    ? mod.status === "approved"
      ? CheckCircle2
      : XCircle
    : Clock;

  return (
    <li className={`rounded-lg border bg-card shadow-sm ${locked ? "opacity-90" : ""}`}>
      {/* Cabecera */}
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-start gap-2 min-w-0">
          <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${statusColor}`} />
          <div className="min-w-0">
            <p className="font-medium leading-tight truncate">{mod.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {requesterLabel(mod.requested_by_role)}
              {" · "}
              {format(parseISO(mod.created_at), "d MMM yyyy", { locale: es })}
              {mod.cost != null && (
                <span className="ml-2 font-medium text-foreground">
                  <Euro className="inline h-3 w-3" />
                  {mod.cost.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {locked && (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <Badge
            variant={
              mod.status === "approved"
                ? "secondary"
                : mod.status === "rejected"
                  ? "destructive"
                  : "default"
            }
            className={mod.status === "pending" ? "bg-orange-500 hover:bg-orange-600" : ""}
          >
            {mod.status === "approved"
              ? "Aprobada"
              : mod.status === "rejected"
                ? "Rechazada"
                : "Pendiente"}
          </Badge>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {/* Descripción */}
          {mod.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">{mod.description}</p>
          )}

          {/* Fotos en esta modificación */}
          {modPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {modPhotos.map((p) => (
                <a key={p.id} href={p.signedUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.signedUrl ?? ""}
                    alt={p.caption ?? p.original_filename}
                    className="aspect-square w-full rounded-md object-cover border"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Adjuntos (documentos) */}
          <EntityAttachments
            requestId={requestId}
            entityType="decision"
            entityId={mod.id}
            attachments={mod.attachments}
            canUpload={!locked}
            compact
          />

          {/* Fechas de resolución */}
          {mod.approved_at && (
            <p className="text-xs text-green-700">
              <CheckCircle2 className="inline h-3 w-3 mr-1" />
              Aprobada el {format(parseISO(mod.approved_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          )}
          {mod.rejected_at && (
            <p className="text-xs text-destructive">
              <XCircle className="inline h-3 w-3 mr-1" />
              Rechazada el {format(parseISO(mod.rejected_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          )}

          {/* Hilo de mensajes */}
          {messages.length > 0 && (
            <div className="space-y-2 rounded-md bg-muted/30 p-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 text-sm ${msg.author_role === currentRole ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.author_role === currentRole
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border"
                    }`}
                  >
                    <p className={`text-[10px] mb-0.5 font-medium ${msg.author_role === currentRole ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {msg.author_role === "admin" ? "Soltegra" : "Cliente"}
                      {" · "}
                      {format(parseISO(msg.created_at), "d MMM HH:mm", { locale: es })}
                    </p>
                    <p className="whitespace-pre-line">{msg.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Nuevo mensaje */}
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Añadir un comentario..."
              rows={2}
              disabled={sendingMsg}
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendMessage();
              }}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={sendMessage}
              disabled={sendingMsg || !newMessage.trim()}
              className="shrink-0 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Botones de aprobación/rechazo */}
          {canRespond(mod, currentRole) && !responding && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => submitRespond("approved")}
                disabled={respondingAction}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                Aprobar modificación
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => submitRespond("rejected")}
                disabled={respondingAction}
                className="text-destructive hover:bg-destructive hover:text-white"
              >
                <XCircle className="h-4 w-4" />
                Rechazar
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ── Formulario de nueva modificación ─────────────────────────────────────────

function NewModificationForm({
  requestId,
  currentRole,
  onCreated,
}: {
  requestId: string;
  currentRole: "client" | "admin";
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim()) { toast.error("El título es obligatorio"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/modifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          title: title.trim(),
          description: description.trim() || null,
          cost: cost ? parseFloat(cost) : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Error al crear la modificación");
      toast.success("Modificación creada");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <p className="text-sm font-medium">Nueva solicitud de modificación</p>
      <div className="space-y-1">
        <Label htmlFor="mod-title" className="text-xs">Título *</Label>
        <Input
          id="mod-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Describe brevemente la modificación"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mod-desc" className="text-xs">Descripción detallada</Label>
        <Textarea
          id="mod-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explica en detalle qué se quiere modificar y por qué..."
          rows={3}
          className="text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mod-cost" className="text-xs">Coste estimado (€) — opcional</Label>
        <Input
          id="mod-cost"
          type="number"
          min="0"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="0.00"
          className="h-8 w-40 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleCreate} disabled={saving || !title.trim()}>
          {saving ? "Creando..." : "Crear modificación"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {currentRole === "client"
          ? "Una vez creada, el equipo de Soltegra deberá aprobarla o rechazarla."
          : "Una vez creada, el cliente deberá aprobarla o rechazarla."}
      </p>
    </div>
  );
}

// ── Módulo principal ──────────────────────────────────────────────────────────

export function ModificationsModule({ module: mod, data, currentRole }: Props) {
  const { decisions, modificationMessages, photos, req } = data;
  const [showForm, setShowForm] = useState(false);

  // Agrupamos mensajes por modification_id
  const messagesByMod = (modificationMessages ?? []).reduce<
    Record<string, ModificationMessage[]>
  >((acc, m) => {
    if (!acc[m.modification_id]) acc[m.modification_id] = [];
    acc[m.modification_id].push(m);
    return acc;
  }, {});

  const pending  = (decisions ?? []).filter((d) => d.status === "pending");
  const resolved = (decisions ?? []).filter((d) => d.status !== "pending");

  const pendingCount = pending.length;

  return (
    <section aria-labelledby="mods-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 id="mods-heading" className="text-lg font-semibold">{mod.label}</h2>
          {pendingCount > 0 && (
            <Badge className="bg-orange-500 hover:bg-orange-600">
              {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          Nueva modificación
        </Button>
      </div>

      {showForm && (
        <NewModificationForm
          requestId={req.id}
          currentRole={currentRole}
          onCreated={() => { setShowForm(false); window.location.reload(); }}
        />
      )}

      {decisions?.length === 0 && !showForm && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No hay modificaciones registradas. Puedes crear una con el botón de arriba.
        </p>
      )}

      {/* Pendientes */}
      {pending.length > 0 && (
        <ul className="space-y-3">
          {pending.map((d) => (
            <ModificationCard
              key={d.id}
              mod={d}
              messages={messagesByMod[d.id] ?? []}
              photos={photos ?? []}
              currentRole={currentRole}
              requestId={req.id}
            />
          ))}
        </ul>
      )}

      {/* Resueltas */}
      {resolved.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <Lock className="h-3.5 w-3.5" />
            {resolved.length} modificación{resolved.length > 1 ? "es" : ""} resuelta{resolved.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-3 space-y-3">
            {resolved.map((d) => (
              <ModificationCard
                key={d.id}
                mod={d}
                messages={messagesByMod[d.id] ?? []}
                photos={photos ?? []}
                currentRole={currentRole}
                requestId={req.id}
              />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
