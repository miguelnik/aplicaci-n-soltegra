// Módulo: Estado de pago
// Por defecto, visible solo para admin (visible_to: "admin").
// Si se configura como visible_to: "both", el cliente ve un mensaje amigable.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ModuleConfig, ModulePageData } from "@/lib/modules/types";

interface Props {
  module: ModuleConfig;
  data: ModulePageData;
  isAdmin?: boolean;
}

export function PaymentStatusModule({ module, data, isAdmin = false }: Props) {
  const { req } = data;

  // No mostrar en borrador ni cancelado
  if (req.status === "draft" || req.status === "cancelled") return null;

  const isPaid = req.is_paid;
  const paidAt = req.paid_at;

  if (isAdmin) {
    // Vista admin: igual que el PaymentToggle existente — este módulo coexiste
    // con el PaymentToggle de la columna de acciones. Aquí solo mostramos estado.
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4" />
            {module.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {isPaid ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Cobrado</span>
                {paidAt && (
                  <span className="text-xs text-muted-foreground">
                    · {format(new Date(paidAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </span>
                )}
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-600">Pendiente de cobro</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Vista cliente: mensaje amigable (solo si el módulo se configura como visible al cliente)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CreditCard className="h-4 w-4" />
          {module.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPaid ? (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Pagado
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pendiente
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
