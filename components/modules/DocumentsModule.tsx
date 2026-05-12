// Módulo: Documentación general
// Muestra documentos del expediente de tipo 'admin_document' o 'client_document'
// que estén marcados como visibles al cliente.
// Para admin, muestra todos los documentos (incluyendo internos).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Lock } from "lucide-react";
import type { ModuleConfig, ModulePageData, ExpeditionDocument } from "@/lib/modules/types";

const CATEGORY_LABELS: Record<string, string> = {
  admin_document: "Documento Soltegra",
  client_document: "Documento cliente",
  deliverable: "Entregable",
};

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
  /** El admin ve documentos internos también */
  isAdmin?: boolean;
}

function DocumentRow({ doc }: { doc: ExpeditionDocument }) {
  return (
    <li className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{doc.label}</span>
            {!doc.is_visible_to_client && (
              <span title="Solo visible para administración"><Lock className="h-3 w-3 shrink-0 text-muted-foreground" /></span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {doc.original_filename}
            {doc.size_bytes != null && ` · ${(doc.size_bytes / 1024).toFixed(0)} KB`}
            {doc.category && (
              <> · <Badge variant="secondary" className="ml-0.5 h-3.5 px-1 text-[9px]">
                {CATEGORY_LABELS[doc.category] ?? doc.category}
              </Badge></>
            )}
          </p>
        </div>
      </div>
      {doc.signedUrl && (
        <Button variant="ghost" size="sm" asChild className="ml-2 shrink-0">
          <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
            <Download className="mr-1 h-3.5 w-3.5" />
            Ver
          </a>
        </Button>
      )}
    </li>
  );
}

export function DocumentsModule({ module, data, isAdmin = false }: Props) {
  const { expeditionDocuments } = data;

  // Filtrar: excluir 'deliverable' (eso va en DeliverablesModule)
  // Admin ve todo; cliente solo los visibles
  const docs = expeditionDocuments.filter((d) => {
    if (d.category === "deliverable") return false;
    if (!isAdmin && !d.is_visible_to_client) return false;
    return true;
  });

  if (docs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {module.label}{" "}
          <span className="font-normal text-muted-foreground">({docs.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {docs.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
