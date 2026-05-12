// Módulo: Archivos aportados por el cliente
// Lista los archivos subidos a través del formulario inicial (request_files).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
}

export function ClientFilesModule({ module, data }: Props) {
  const { filesWithUrls } = data;

  if (filesWithUrls.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {module.label}{" "}
          <span className="font-normal text-muted-foreground">
            ({filesWithUrls.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {filesWithUrls.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.original_filename}</span>
                {f.size_bytes != null && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {(f.size_bytes / 1024).toFixed(0)} KB
                  </span>
                )}
              </div>
              {f.signedUrl && (
                <Button variant="ghost" size="sm" asChild className="ml-2 shrink-0">
                  <a href={f.signedUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Ver
                  </a>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
