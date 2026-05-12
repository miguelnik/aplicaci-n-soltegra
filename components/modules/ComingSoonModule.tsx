// Módulo: Próximamente
// Placeholder para módulos configurados pero no implementados aún.
// Solo visible para admin (nunca se muestra al cliente para módulos no implementados).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hourglass } from "lucide-react";
import type { ModuleConfig } from "@/lib/modules/types";

interface Props {
  module: ModuleConfig;
  /** Si es false, el componente retorna null (no visible al cliente) */
  isAdmin?: boolean;
}

export function ComingSoonModule({ module, isAdmin = false }: Props) {
  // Módulos no implementados NUNCA se muestran al cliente
  if (!isAdmin) return null;

  return (
    <Card className="border-dashed opacity-60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Hourglass className="h-4 w-4" />
          {module.label}
          <Badge variant="outline" className="ml-auto text-[10px]">
            Próximamente
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Este módulo está configurado para este servicio pero aún no está disponible.
          Se habilitará en una próxima actualización de la plataforma.
        </p>
      </CardContent>
    </Card>
  );
}
