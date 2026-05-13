"use client";

import { useRef, useState } from "react";
import { Download, FileText, Image as ImageIcon, Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { ExpeditionAttachment } from "@/lib/modules/expedition-types";

interface Props {
  requestId: string;
  entityType: "decision" | "incident" | "site_visit";
  entityId: string;
  attachments?: ExpeditionAttachment[];
  canUpload?: boolean;
  compact?: boolean;
}

function isImage(mime: string | null) {
  return Boolean(mime?.startsWith("image/"));
}

export function EntityAttachments({
  requestId,
  entityType,
  entityId,
  attachments = [],
  canUpload = false,
  compact = false,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    let uploaded = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestId", requestId);
      fd.append("entityType", entityType);
      fd.append("entityId", entityId);

      const res = await fetch("/api/expedition-attachments/upload", {
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
    if (inputRef.current) inputRef.current.value = "";
    if (uploaded > 0) {
      toast.success(`${uploaded} archivo${uploaded > 1 ? "s" : ""} subido${uploaded > 1 ? "s" : ""}`);
      window.location.reload();
    }
  }

  if (!canUpload && attachments.length === 0) return null;

  return (
    <div className={compact ? "mt-2 space-y-2" : "space-y-2"}>
      {attachments.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="rounded-md border bg-muted/20 p-2 text-xs">
              {isImage(attachment.mime_type) && attachment.signedUrl ? (
                <a href={attachment.signedUrl} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.signedUrl}
                    alt={attachment.original_filename}
                    className="mb-2 aspect-video w-full rounded object-cover"
                  />
                </a>
              ) : null}
              <div className="flex items-center gap-2">
                {isImage(attachment.mime_type) ? (
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">{attachment.original_filename}</span>
                {attachment.signedUrl && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <a href={attachment.signedUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {attachment.uploaded_by_role === "admin" ? "Soltegra" : "Cliente"}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
          {uploading ? <Upload className="h-3.5 w-3.5 animate-pulse" /> : <Paperclip className="h-3.5 w-3.5" />}
          {uploading ? "Subiendo..." : "Añadir fotos o PDF"}
          <Input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif,application/pdf"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(event) => uploadFiles(event.target.files)}
          />
        </label>
      )}
    </div>
  );
}
