"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileText, X } from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "deliverable",    label: "Entregable (visible al cliente)" },
  { value: "client_document", label: "Documento del cliente" },
  { value: "admin_document", label: "Documento interno (solo admin)" },
];

interface Props {
  requestId: string;
  organizationId: string;
}

/** Quita la extensión de un nombre de archivo para usarlo como etiqueta. */
function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

export function ExpeditionDocUploader({ requestId, organizationId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("deliverable");
  const [visibleToClient, setVisibleToClient] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files ?? []));
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  /** Calcula la etiqueta de cada documento.
   *  - 1 archivo + label → label
   *  - varios archivos + label → "label — nombre" para distinguirlos
   *  - sin label → nombre del archivo sin extensión */
  function labelFor(file: File, total: number): string {
    const base = stripExt(file.name);
    const trimmed = label.trim();
    if (!trimmed) return base;
    if (total === 1) return trimmed;
    return `${trimmed} — ${base}`;
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      toast.error("Selecciona al menos un archivo");
      return;
    }

    setUploading(true);
    let ok = 0;
    let failed = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Subiendo ${i + 1} de ${files.length}: ${file.name}`);

        const fd = new FormData();
        fd.append("file", file);
        fd.append("requestId", requestId);
        fd.append("organizationId", organizationId);
        fd.append("label", labelFor(file, files.length));
        fd.append("category", category);
        fd.append("visibleToClient", visibleToClient ? "1" : "0");

        try {
          const res = await fetch("/api/admin/expedition-docs/upload", {
            method: "POST",
            body: fd,
          });
          const json = await res.json().catch(() => ({}));
          if (json.ok) ok++;
          else { failed++; toast.error(`${file.name}: ${json.error ?? "error"}`); }
        } catch {
          failed++;
          toast.error(`${file.name}: error de red`);
        }
      }

      if (ok > 0) {
        toast.success(
          ok === 1 ? "Documento subido correctamente" : `${ok} documentos subidos correctamente`,
        );
        setLabel("");
        setFiles([]);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
      if (failed > 0 && ok === 0) {
        toast.error("No se pudo subir ningún documento");
      }
    } finally {
      setUploading(false);
      setProgress("");
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="doc-label" className="text-xs">
          Nombre del documento
          {files.length > 1 && <span className="ml-1 text-muted-foreground">(opcional — prefijo común)</span>}
          {files.length <= 1 && <span className="ml-1 text-muted-foreground">(opcional)</span>}
        </Label>
        <Input
          id="doc-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={
            files.length > 1
              ? "Prefijo para todos (si lo dejas vacío, se usa el nombre de cada archivo)"
              : "Ej: Memoria descriptiva… (si lo dejas vacío, se usa el nombre del archivo)"
          }
          className="h-8 text-sm"
          disabled={uploading}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="doc-category" className="text-xs">Tipo</Label>
          <select
            id="doc-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (e.target.value === "admin_document") setVisibleToClient(false);
              else setVisibleToClient(true);
            }}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            disabled={uploading}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 pb-0.5">
          <input
            type="checkbox"
            id="doc-visible"
            checked={visibleToClient}
            onChange={(e) => setVisibleToClient(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
            disabled={uploading}
          />
          <Label htmlFor="doc-visible" className="cursor-pointer text-xs">
            Visible para el cliente
          </Label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="doc-file" className="text-xs">
          Archivos * <span className="text-muted-foreground">(puedes seleccionar varios)</span>
        </Label>
        <Input
          id="doc-file"
          type="file"
          ref={fileRef}
          multiple
          onChange={onPickFiles}
          className="h-8 text-xs"
          disabled={uploading}
        />
      </div>

      {/* Lista de archivos seleccionados */}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Quitar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {progress && (
        <p className="text-xs text-muted-foreground">{progress}</p>
      )}

      <Button type="submit" size="sm" disabled={uploading || files.length === 0} className="w-full">
        {uploading ? (
          <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Subiendo…</>
        ) : (
          <>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {files.length > 1 ? `Subir ${files.length} documentos` : "Subir documento"}
          </>
        )}
      </Button>
    </form>
  );
}
