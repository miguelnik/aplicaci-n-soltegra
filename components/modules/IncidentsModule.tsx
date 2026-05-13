"use client";

// Módulo: Registro de incidencias
// Muestra incidencias publicadas. Por defecto solo visible al admin.

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, AlertCircle, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EntityAttachments } from "./EntityAttachments";
import { toast } from "sonner";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";
import type { IncidentSeverity, IncidentStatus } from "@/lib/modules/expedition-types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
  currentRole: "client" | "admin";
}

const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  low:      { label: "Baja",     variant: "secondary" },
  medium:   { label: "Media",    variant: "outline" },
  high:     { label: "Alta",     variant: "default" },
  critical: { label: "Crítica",  variant: "destructive" },
};

const STATUS_ICONS: Record<IncidentStatus, React.ReactNode> = {
  open:        <AlertCircle className="h-4 w-4 text-orange-500" />,
  in_progress: <Clock className="h-4 w-4 text-blue-600" />,
  resolved:    <CheckCircle2 className="h-4 w-4 text-green-600" />,
  closed:      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open:        "Abierta",
  in_progress: "En gestión",
  resolved:    "Resuelta",
  closed:      "Cerrada",
};

export function IncidentsModule({ module: mod, data, currentRole }: Props) {
  const { incidents, req } = data;
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canCreate = currentRole === "client";

  const open = (incidents ?? []).filter((i) => i.status === "open" || i.status === "in_progress");

  async function submitIncident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    if (!title) {
      toast.error("Escribe un título para la incidencia");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/client/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: req.id,
          title,
          description: String(formData.get("description") ?? "").trim(),
          severity: String(formData.get("severity") ?? "medium"),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.id) throw new Error(body.error ?? "No se pudo crear");

      const files = fileRef.current?.files;
      if (files && files.length > 0) {
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("requestId", req.id);
          fd.append("entityType", "incident");
          fd.append("entityId", body.id);
          const upload = await fetch("/api/expedition-attachments/upload", {
            method: "POST",
            body: fd,
          });
          if (!upload.ok) {
            const errorBody = await upload.json().catch(() => ({}));
            toast.error(`Incidencia creada, pero falló ${file.name}: ${errorBody.error ?? "error"}`);
          }
        }
      }

      toast.success("Incidencia creada");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la incidencia");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="incidents-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="incidents-heading" className="flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          {mod.label}
        </h2>
        {open.length > 0 && (
          <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
            {open.length} abierta{open.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {canCreate && (
        <div className="rounded-lg border bg-card p-4">
          {!showForm ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Crear incidencia
            </Button>
          ) : (
            <form onSubmit={submitIncident} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="incident-title">Tipo de incidencia</Label>
                  <Input id="incident-title" name="title" required disabled={submitting} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="incident-severity">Gravedad</Label>
                  <select
                    id="incident-severity"
                    name="severity"
                    defaultValue="medium"
                    disabled={submitting}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="incident-description">Descripción</Label>
                  <Textarea id="incident-description" name="description" rows={3} disabled={submitting} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="incident-files">Fotos o PDF</Label>
                  <Input
                    ref={fileRef}
                    id="incident-files"
                    type="file"
                    accept="image/*,.heic,.heif,application/pdf"
                    multiple
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? "Creando..." : "Crear incidencia"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {(!incidents || incidents.length === 0) && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No hay incidencias registradas.
        </p>
      )}

      <ul className="space-y-2">
        {(incidents ?? []).map((inc) => {
          const sev = SEVERITY_CONFIG[inc.severity] ?? SEVERITY_CONFIG.medium;
          return (
            <li
              key={inc.id}
              className="rounded-lg border bg-card px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {STATUS_ICONS[inc.status]}
                  <div>
                    <p className="font-medium leading-tight">{inc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {STATUS_LABELS[inc.status]}
                      {inc.resolved_at &&
                        ` · ${format(parseISO(inc.resolved_at), "d MMM yyyy", { locale: es })}`}
                    </p>
                  </div>
                </div>
                <Badge variant={sev.variant}>{sev.label}</Badge>
              </div>
              {inc.description && (
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {inc.description}
                </p>
              )}
              <EntityAttachments
                requestId={data.req.id}
                entityType="incident"
                entityId={inc.id}
                attachments={inc.attachments}
                canUpload={currentRole === "client" || currentRole === "admin"}
                compact
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Registrada el{" "}
                {format(parseISO(inc.created_at), "d MMM yyyy", { locale: es })}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
