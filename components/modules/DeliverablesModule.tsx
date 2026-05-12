// Módulo: Entregables
// Muestra los entregables finales del expediente.
// Compatibilidad hacia atrás garantizada:
//   - Si existe certificate_pdf_path → muestra botón de descarga del certificado energético
//   - Si existen expedition_documents con category='deliverable' → los lista también
// Para certificados energéticos sin expedition_documents, el comportamiento
// es idéntico al actual: solo el botón de descarga del PDF.

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileCheck2, Package } from "lucide-react";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
}

export function DeliverablesModule({ module, data }: Props) {
  const { req, expeditionDocuments } = data;

  const hasCertificatePdf = req.status === "delivered" && !!req.certificate_pdf_path;
  const deliverableDocs = expeditionDocuments.filter(
    (d) => d.category === "deliverable" && d.is_visible_to_client,
  );

  const hasAnything = hasCertificatePdf || deliverableDocs.length > 0;

  if (!hasAnything) {
    // Si no hay nada que mostrar, solo renderizar cuando está entregado
    // para dar feedback al usuario de que se esperan entregables
    if (req.status !== "delivered") return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            {module.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            El equipo de Soltegra preparará los entregables próximamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck2 className="h-4 w-4 text-green-600" />
          {module.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* ── Certificado PDF legacy (backward compat) ── */}
        {hasCertificatePdf && (
          <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <FileCheck2 className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">
                Certificado energético
              </span>
            </div>
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/solicitudes/${req.id}/descargar`}>
                <Download className="h-3.5 w-3.5" />
                Descargar
              </Link>
            </Button>
          </div>
        )}

        {/* ── Entregables de expedition_documents ── */}
        {deliverableDocs.length > 0 && (
          <ul className="space-y-2">
            {deliverableDocs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{doc.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.original_filename}
                      {doc.size_bytes != null &&
                        ` · ${(doc.size_bytes / 1024).toFixed(0)} KB`}
                    </p>
                  </div>
                </div>
                {doc.signedUrl && (
                  <Button variant="ghost" size="sm" asChild className="ml-2 shrink-0">
                    <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Descargar
                    </a>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
