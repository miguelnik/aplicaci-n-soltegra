"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { validateFile, validateFileCount } from "@/lib/form-schema/validate";
import type { FileBlock } from "@/lib/form-schema/types";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { nanoid } from "nanoid";
import { toast } from "sonner";

interface UploadedFile {
  id: string;
  name: string;
  path: string;
  mime: string;
  size: number;
}

interface Props {
  fileBlock: FileBlock;
  requestId: string;
  organizationId: string;
  disabled?: boolean;
  error?: string | null;
  onFilesChange?: (key: string, count: number) => void;
  /** Called before upload starts; return false to abort (e.g. to ensure draft exists) */
  onBeforeUpload?: () => Promise<boolean>;
}

export function FileUploader({
  fileBlock,
  requestId,
  organizationId,
  disabled,
  error,
  onFilesChange,
  onBeforeUpload,
}: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (disabled) return;

      const maxNew = fileBlock.maxCount ? fileBlock.maxCount - files.length : accepted.length;
      const toUpload = accepted.slice(0, maxNew);

      if (toUpload.length === 0) {
        toast.error(`Máximo ${fileBlock.maxCount} archivos`);
        return;
      }

      // Ensure the draft request exists in DB before uploading files
      if (onBeforeUpload) {
        const ok = await onBeforeUpload();
        if (!ok) return;
      }

      setUploading(true);
      const supabase = createSupabaseBrowserClient();
      const newUploaded: UploadedFile[] = [];

      for (const file of toUpload) {
        const validationError = validateFile(
          { name: file.name, type: file.type, size: file.size },
          fileBlock,
        );
        if (validationError) {
          toast.error(validationError);
          continue;
        }

        try {
          // Comprimir imágenes antes de subir
          let fileToUpload: File = file;
          if (file.type.startsWith("image/") && file.size > 500_000) {
            fileToUpload = await imageCompression(file, {
              maxSizeMB: fileBlock.maxSizeMb ?? 10,
              maxWidthOrHeight: 2400,
              useWebWorker: true,
            });
          }

          const ext = file.name.split(".").pop();
          const path = `${organizationId}/${requestId}/${fileBlock.key}/${nanoid()}.${ext}`;

          const { error } = await supabase.storage
            .from("request-uploads")
            .upload(path, fileToUpload, { contentType: file.type });

          if (error) {
            toast.error(`Error subiendo ${file.name}`);
            continue;
          }

          const { error: dbError } = await supabase.from("request_files").insert({
            request_id: requestId,
            field_key: fileBlock.key,
            storage_path: path,
            original_filename: file.name,
            mime_type: file.type,
            size_bytes: fileToUpload.size,
          });

          if (dbError) {
            await supabase.storage.from("request-uploads").remove([path]);
            toast.error(`Error registrando ${file.name}`);
            continue;
          }

          newUploaded.push({
            id: nanoid(),
            name: file.name,
            path,
            mime: file.type,
            size: fileToUpload.size,
          });
        } catch {
          toast.error(`Error procesando ${file.name}`);
        }
      }

      setFiles((prev) => {
        const next = [...prev, ...newUploaded];
        onFilesChange?.(fileBlock.key, next.length);
        return next;
      });
      setUploading(false);
    },
    [files, fileBlock, requestId, organizationId, disabled, onBeforeUpload, onFilesChange],
  );

  const removeFile = async (file: UploadedFile) => {
    const supabase = createSupabaseBrowserClient();
    await supabase.storage.from("request-uploads").remove([file.path]);
    await supabase.from("request_files").delete().eq("storage_path", file.path);
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== file.id);
      onFilesChange?.(fileBlock.key, next.length);
      return next;
    });
  };

  const countError = error ?? validateFileCount(files.length, fileBlock);
  const isImage = (mime: string) => mime.startsWith("image/");

  // react-dropzone tiene `multiple: true` como default si recibe undefined.
  // Forzamos a boolean para respetar la configuración del admin.
  const allowMultiple = fileBlock.multiple === true;

  // Convierte el array accept del schema al Record<MimeType, Extension[]> de react-dropzone.
  // "image/*" => { "image/*": [] }
  // ".dxf"    => { "application/octet-stream": [".dxf"] }
  // "*/*"     => {} (sin restriccion, acepta todo)
  function buildDropzoneAccept(accept: string[]): Record<string, string[]> {
    // Comodín total: sin restricción en react-dropzone
    if (accept.includes("*/*") || accept.includes("*")) return {};

    const result: Record<string, string[]> = {};
    for (const a of accept) {
      if (a.startsWith(".")) {
        // Extensión: la agrupamos bajo octet-stream para que react-dropzone
        // aplique el filtro por extensión en el selector de archivos del OS.
        if (!result["application/octet-stream"]) result["application/octet-stream"] = [];
        result["application/octet-stream"].push(a);
      } else {
        result[a] = result[a] ?? [];
      }
    }
    return result;
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: buildDropzoneAccept(fileBlock.accept),
    multiple: allowMultiple,
    maxFiles: allowMultiple ? fileBlock.maxCount : 1,
    disabled: disabled || uploading,
  });

  return (
    <div className="space-y-2">
      <Label>
        {fileBlock.label}
        {fileBlock.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {fileBlock.helpText && (
        <p className="text-xs text-muted-foreground">{fileBlock.helpText}</p>
      )}

      {!disabled && (
        <div
          {...getRootProps()}
          className={cn(
            "cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50",
            (disabled || uploading) && "pointer-events-none opacity-50",
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isDragActive
              ? "Suelta los archivos aquí"
              : uploading
                ? "Subiendo..."
                : "Arrastra archivos o haz clic para seleccionar"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {fileBlock.accept.join(", ")} · Máx. {fileBlock.maxSizeMb ?? 10} MB
          </p>
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
            >
              {isImage(f.mime) ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(f.size / 1024).toFixed(0)} KB
              </span>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => removeFile(f)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {countError && <p className="text-xs text-destructive">{countError}</p>}
    </div>
  );
}
