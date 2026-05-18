"use client";

// Error boundary para la sección de contabilidad.
// Captura cualquier excepción que ocurra en server components hijos
// y muestra el mensaje real en lugar de la pantalla genérica de Next.

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ContabilidadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Error cargando la sección de contabilidad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium">Mensaje:</p>
        <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
          {error.message || "Error desconocido"}
        </pre>
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Digest: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Ver stack trace
          </summary>
          <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-[10px]">
            {error.stack ?? "(sin stack)"}
          </pre>
        </details>
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
