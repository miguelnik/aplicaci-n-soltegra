"use client";

import { useState, useRef } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  requestId: string;
  organizationId: string;
}

export function PhotoUploader({ requestId, organizationId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!files || files.length === 0) {
      toast.error("Selecciona al menos una foto");
      return;
    }

    const form = e.currentTarget;
    const caption = (form.elements.namedItem("caption") as HTMLInputElement)?.value?.trim() || "";
    const takenAt = (form.elements.namedItem("takenAt") as HTMLInputElement)?.value || "";
    const visibleToClient = (form.elements.namedItem("visibleToClient") as HTMLInputElement)?.checked;

    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestId", requestId);
      fd.append("organizationId", organizationId);
      if (caption) fd.append("caption", caption);
      if (takenAt) fd.append("takenAt", takenAt);
      fd.append("visibleToClient", visibleToClient ? "1" : "0");

      const res = await fetch("/api/admin/expedition-photos/upload", {
        method: "POST",
        body: fd,
      });

      if (res.ok) {
        successCount++;
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(`Error subiendo ${file.name}: ${data.error ?? "error desconocido"}`);
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} foto${successCount > 1 ? "s" : ""} subida${successCount > 1 ? "s" : ""} correctamente`);
      formRef.current?.reset();
      setFiles(null);
      // Refresh page to show new photos
      window.location.reload();
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="photo-files">
            Fotos <span className="text-destructive">*</span>
          </Label>
          <Input
            id="photo-files"
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            required
            disabled={uploading}
            onChange={(e) => setFiles(e.target.files)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="photo-taken">Fecha de la foto</Label>
          <Input id="photo-taken" name="takenAt" type="date" disabled={uploading} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="photo-caption">Descripción (opcional)</Label>
          <Input
            id="photo-caption"
            name="caption"
            placeholder="Descripción de la foto..."
            disabled={uploading}
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="photo-visible"
            name="visibleToClient"
            type="checkbox"
            defaultChecked
            className="h-4 w-4"
            disabled={uploading}
          />
          <Label htmlFor="photo-visible" className="font-normal">
            Visible al cliente
          </Label>
        </div>
      </div>

      <Button type="submit" disabled={uploading} size="sm">
        <Upload className="mr-1.5 h-4 w-4" />
        {uploading
          ? "Subiendo..."
          : files && files.length > 0
          ? `Subir ${files.length} foto${files.length > 1 ? "s" : ""}`
          : "Subir fotos"}
      </Button>
    </form>
  );
}
