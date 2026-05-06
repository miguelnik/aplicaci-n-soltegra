"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle } from "lucide-react";
import { nanoid } from "nanoid";

interface Props {
  requestId: string;
  organizationId: string;
  currentPdfPath: string | null;
}

export function PdfUploader({ requestId, organizationId, currentPdfPath }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(!!currentPdfPath);
  const router = useRouter();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploading,
    onDrop: async (files) => {
      const file = files[0];
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) { toast.error("El PDF no puede superar 25 MB"); return; }

      setUploading(true);
      const supabase = createSupabaseBrowserClient();
      const path = `${organizationId}/${requestId}/certificado-${nanoid(6)}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("certificates")
        .upload(path, file, { contentType: "application/pdf", upsert: true });

      if (uploadError) { toast.error("Error al subir el PDF"); setUploading(false); return; }

      const { error: updateError } = await supabase
        .from("certificate_requests")
        .update({ certificate_pdf_path: path })
        .eq("id", requestId);

      if (updateError) { toast.error("Error al registrar el PDF"); setUploading(false); return; }

      toast.success("Certificado subido correctamente");
      setUploaded(true);
      setUploading(false);
      router.refresh();
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Certificado final (PDF)</CardTitle>
      </CardHeader>
      <CardContent>
        {uploaded ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span>PDF subido. Puedes reemplazarlo arrastrando uno nuevo.</span>
          </div>
        ) : null}
        <div
          {...getRootProps()}
          className={`mt-3 cursor-pointer rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
            isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          } ${uploading ? "pointer-events-none opacity-50" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {uploading ? "Subiendo..." : "Arrastra el PDF o haz clic · Máx. 25 MB"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
