"use client";

// Panel ERP de una solicitud (visible sólo al admin):
//   - Precio del servicio (editable inline)
//   - Visibilidad para el cliente (oculto al cliente)

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Euro, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { updateRequestErp } from "./actions";

interface Props {
  requestId: string;
  initialPrice: number | null;
  initialHidden: boolean;
}

export function ErpPanel({ requestId, initialPrice, initialHidden }: Props) {
  const [price, setPrice]   = useState(initialPrice != null ? String(initialPrice) : "");
  const [hidden, setHidden] = useState(initialHidden);
  const [saving, startTransition] = useTransition();

  function savePrice() {
    const parsed = price === "" ? null : parseFloat(price);
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) {
      toast.error("Importe inválido");
      return;
    }
    startTransition(async () => {
      const res = await updateRequestErp(requestId, { price: parsed });
      if (res.ok) toast.success("Precio actualizado");
      else toast.error(res.error ?? "Error al guardar");
    });
  }

  function toggleHidden() {
    const next = !hidden;
    startTransition(async () => {
      const res = await updateRequestErp(requestId, { is_hidden_from_client: next });
      if (res.ok) {
        setHidden(next);
        toast.success(next ? "Solicitud ocultada al cliente" : "Solicitud visible al cliente");
      } else {
        toast.error(res.error ?? "Error al guardar");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Gestión interna</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Precio */}
        <div className="space-y-1.5">
          <Label htmlFor="price" className="flex items-center gap-1.5 text-xs font-medium">
            <Euro className="h-3.5 w-3.5" />
            Precio del servicio (EUR)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Sin precio"
              className="h-8 w-36 text-sm"
              disabled={saving}
              onKeyDown={(e) => { if (e.key === "Enter") savePrice(); }}
            />
            <Button size="sm" onClick={savePrice} disabled={saving}>
              Guardar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Este precio es interno. No se muestra al cliente.
          </p>
        </div>

        {/* Oculto al cliente */}
        <div className="space-y-1.5 border-t pt-3">
          <Label className="flex items-center gap-1.5 text-xs font-medium">
            {hidden ? (
              <EyeOff className="h-3.5 w-3.5 text-orange-500" />
            ) : (
              <Eye className="h-3.5 w-3.5 text-green-600" />
            )}
            Visibilidad para el cliente
          </Label>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {hidden ? "Oculto al cliente" : "Visible para el cliente"}
            </span>
            <Button
              size="sm"
              variant={hidden ? "outline" : "secondary"}
              onClick={toggleHidden}
              disabled={saving}
            >
              {hidden ? "Hacer visible" : "Ocultar"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Si está oculto, el cliente nunca verá esta solicitud en su portal.
            Útil para servicios internos o proyectos gestionados al margen.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
