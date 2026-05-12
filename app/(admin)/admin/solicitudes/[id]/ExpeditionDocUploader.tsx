"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "deliverable",    label: "Entregable (visible al cliente)" },
  { value: "client_document", label: "Documento del cliente" },
  { value: "admin_document", label: "Documento interno (solo admin)" },
];

interface Props {
  requestId: string;
  organizationId: string;
}

export function ExpeditionDocUploader({ requestId, organizationId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("deliverable");
  const [visibleToClient, setVisibleToClient] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecciona un archivo");
      return;
    }
    if (!label.trim()) {
      toast.error("Escribe un nombre para el documento");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestId", requestId);
      fd.append("organizationId", organizationId);
      fd.append("label", label.trim());
      fd.append("category", category);
      fd.append("visibleToClient", visibleToClient ? "1" : "0");

      const res = await fetch("/api/admin/expedition-docs/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error("Error al subir: " + (json.error ?? "desconocido"));
        return;
      }
      toast.success("Documento subido correctamente");
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de red");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="doc-label" className="text-xs">
          Nombre del documento *
        </Label>
        <Input
          id="doc-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej: Memoria descriptiva, Plano de planta..."
          className="h-8 text-sm"
          disabled={uploading}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="doc-category" className="text-xs">
            Tipo
          </Label>
          <select
            id="doc-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              // Los documentos internos no son visibles al cliente por defecto
              if (e.target.value === "admin_document") setVisibleToClient(false);
              else setVisibleToClient(true);
            }}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            disabled={uploading}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
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
          Archivo *
        </Label>
        <Input
          id="doc-file"
          type="file"
          ref={fileRef}
          className="h-8 text-xs"
          disabled={uploading}
        />
      </div>

      <Button type="submit" size="sm" disabled={uploading} className="w-full">
        {uploading ? (
          <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Subiendo...</>
        ) : (
          <><Upload className="mr-1.5 h-3.5 w-3.5" /> Subir documento</>
        )}
      </Button>
    </form>
  );
}
