// Módulo: Visitas de obra
// Lista cronológica de visitas realizadas al emplazamiento.
// Permite subir fotos por visita (que también aparecen en la galería global).

"use client";

import { useState, useRef } from "react";
import { HardHat, Calendar, Camera, X, ImagePlus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { EntityAttachments } from "./EntityAttachments";
import { toast } from "sonner";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";
import type { ExpeditionPhoto } from "@/lib/modules/expedition-types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
  currentRole: "client" | "admin";
}

// ── Subcomponente: miniaturas de fotos de una visita ──────────────────────────

function VisitPhotos({
  photos,
  visitId,
  requestId,
}: {
  photos: ExpeditionPhoto[];
  visitId: string;
  requestId: string;
}) {
  const visitPhotos = photos.filter(
    (p) => p.source_entity_type === "site_visit" && p.source_entity_id === visitId,
  );
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let allOk = true;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestId", requestId);
      fd.append("sourceEntityType", "site_visit");
      fd.append("sourceEntityId", visitId);
      fd.append("visibleToClient", "1");

      try {
        const res = await fetch("/api/admin/expedition-photos/upload", {
          method: "POST",
          body: fd,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body.error ?? `Error al subir ${file.name}`);
          allOk = false;
        }
      } catch {
        toast.error(`Error al subir ${file.name}`);
        allOk = false;
      }
    }
    setUploading(false);
    if (allOk) {
      toast.success(files.length > 1 ? "Fotos subidas" : "Foto subida");
      window.location.reload();
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {visitPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visitPhotos.map((p) => (
            <a
              key={p.id}
              href={p.signedUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.signedUrl ?? ""}
                alt={p.caption ?? p.original_filename}
                className="aspect-square w-full rounded-md border object-cover transition-opacity group-hover:opacity-90"
              />
            </a>
          ))}
        </div>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-7"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {uploading ? "Subiendo..." : "Añadir fotos"}
        </Button>
      </div>
    </div>
  );
}

// ── Módulo principal ──────────────────────────────────────────────────────────

export function SiteVisitsModule({ module: mod, data, currentRole }: Props) {
  const { siteVisits, photos, req } = data;
  const sorted = siteVisits && siteVisits.length > 0
    ? [...siteVisits].sort((a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime())
    : [];

  return (
    <section aria-labelledby="site-visits-heading" className="space-y-3">
      <h2 id="site-visits-heading" className="flex items-center gap-2 text-lg font-semibold">
        <HardHat className="h-5 w-5 text-muted-foreground" />
        {mod.label}
      </h2>

      {sorted.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no se han registrado visitas de obra.
        </p>
      )}

      <ol className="space-y-3">
        {sorted.map((visit) => (
          <li
            key={visit.id}
            className="rounded-lg border bg-card px-4 py-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(parseISO(visit.visited_at), "EEEE, d 'de' MMMM 'de' yyyy", {
                  locale: es,
                })}
              </div>
              <span className="text-sm text-muted-foreground">{visit.technician}</span>
            </div>
            {visit.observations && (
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                {visit.observations}
              </p>
            )}

            {/* Fotos de esta visita + botón para subir más */}
            <VisitPhotos
              photos={photos ?? []}
              visitId={visit.id}
              requestId={req.id}
            />

            {/* Adjuntos (documentos) de la visita */}
            <EntityAttachments
              requestId={req.id}
              entityType="site_visit"
              entityId={visit.id}
              attachments={visit.attachments}
              canUpload={currentRole === "admin"}
              compact
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
