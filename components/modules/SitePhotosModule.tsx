"use client";

// Módulo: Galería de fotos de obra
// Grid de thumbnails con lightbox básico (dialog nativo).

import { useState } from "react";
import { Image as ImageIcon, X, Calendar, Upload } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
  currentRole: "client" | "admin";
}

export function SitePhotosModule({ module: mod, data, currentRole }: Props) {
  const { photos, req } = data;
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [lightboxCaption, setLightboxCaption] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const sorted =
    photos && photos.length > 0
      ? [...photos].sort(
          (a, b) =>
            new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
        )
      : [];

  function openLightbox(url: string, caption: string | null) {
    setLightbox(url);
    setLightboxCaption(caption);
  }

  function closeLightbox() {
    setLightbox(null);
    setLightboxCaption(null);
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestId", req.id);
      fd.append("visibleToClient", "1");
      const res = await fetch("/api/admin/expedition-photos/upload", {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        uploaded++;
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(`Error subiendo ${file.name}: ${body.error ?? "error desconocido"}`);
      }
    }

    setUploading(false);
    if (uploaded > 0) {
      toast.success(`${uploaded} foto${uploaded > 1 ? "s" : ""} subida${uploaded > 1 ? "s" : ""}`);
      window.location.reload();
    }
  }

  return (
    <section aria-labelledby="photos-heading" className="space-y-3">
      <h2
        id="photos-heading"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
        {mod.label}
        {sorted.length > 0 && (
          <span className="text-sm font-normal text-muted-foreground">
            ({sorted.length})
          </span>
        )}
      </h2>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
        <Upload className={uploading ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
        {uploading ? "Subiendo..." : currentRole === "client" ? "Subir fotos" : "Añadir fotos"}
        <Input
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(event) => uploadPhotos(event.target.files)}
        />
      </label>

      {sorted.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no hay fotos de obra publicadas.
        </p>
      )}

      {sorted.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {sorted.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => openLightbox(photo.signedUrl ?? "", photo.caption)}
              disabled={!photo.signedUrl}
            >
              {photo.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.signedUrl}
                  alt={photo.caption ?? photo.original_filename}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
              {/* Overlay con fecha */}
              {photo.taken_at && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="flex items-center gap-1 text-[10px] text-white">
                    <Calendar className="h-2.5 w-2.5" />
                    {format(parseISO(photo.taken_at), "d MMM yyyy", { locale: es })}
                  </p>
                </div>
              )}
              <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {photo.uploaded_by_role === "client" ? "Cliente" : "Soltegra"}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            onClick={closeLightbox}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox}
              alt={lightboxCaption ?? "Foto de obra"}
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
            />
            {lightboxCaption && (
              <p className="mt-2 text-center text-sm text-white/80">
                {lightboxCaption}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
