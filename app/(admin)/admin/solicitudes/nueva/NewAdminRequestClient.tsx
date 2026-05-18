"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createAdminRequest } from "./actions";

interface Org { id: string; name: string }
interface Svc { id: string; name: string; slug: string }

interface Props {
  organizations: Org[];
  services: Svc[];
}

export function NewAdminRequestClient({ organizations, services }: Props) {
  const router = useRouter();
  const [orgId, setOrgId]                 = useState("");
  const [serviceId, setServiceId]         = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [clientNotes, setClientNotes]     = useState("");
  const [clientDeadline, setClientDeadline] = useState("");
  const [price, setPrice]                 = useState("");
  const [hidden, setHidden]               = useState(false);
  const [pending, startTransition]        = useTransition();

  function submit() {
    if (!orgId)                  { toast.error("Selecciona un cliente"); return; }
    if (!serviceId)              { toast.error("Selecciona un servicio"); return; }
    if (!propertyAddress.trim()) { toast.error("Falta el nombre/dirección"); return; }

    const parsedPrice = price === "" ? null : parseFloat(price);
    if (parsedPrice != null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      toast.error("Precio inválido");
      return;
    }

    startTransition(async () => {
      const res = await createAdminRequest({
        organizationId: orgId,
        serviceTypeId: serviceId,
        propertyAddress: propertyAddress.trim(),
        clientNotes: clientNotes || null,
        clientDeadline: clientDeadline || null,
        price: parsedPrice,
        isHiddenFromClient: hidden,
      });

      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Solicitud creada");
      router.push(`/admin/solicitudes/${res.id}`);
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Datos del proyecto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Cliente */}
          <div className="space-y-1">
            <Label htmlFor="org" className="text-xs">Cliente *</Label>
            <select
              id="org"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              disabled={pending}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">— Selecciona un cliente —</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          {/* Servicio */}
          <div className="space-y-1">
            <Label htmlFor="svc" className="text-xs">Servicio *</Label>
            <select
              id="svc"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              disabled={pending}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">— Selecciona un servicio —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Nombre / dirección */}
        <div className="space-y-1">
          <Label htmlFor="addr" className="text-xs">Nombre del proyecto / dirección *</Label>
          <Input
            id="addr"
            value={propertyAddress}
            onChange={(e) => setPropertyAddress(e.target.value)}
            placeholder="Ej: Vivienda C/ Real 12, Granada"
            disabled={pending}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Precio */}
          <div className="space-y-1">
            <Label htmlFor="price" className="text-xs">Precio interno (EUR) — opcional</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              disabled={pending}
            />
            <p className="text-[11px] text-muted-foreground">
              Este precio es interno, no se muestra al cliente.
            </p>
          </div>

          {/* Fecha límite del cliente */}
          <div className="space-y-1">
            <Label htmlFor="dead" className="text-xs">Fecha límite del cliente (opcional)</Label>
            <Input
              id="dead"
              type="date"
              value={clientDeadline}
              onChange={(e) => setClientDeadline(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        {/* Notas del cliente */}
        <div className="space-y-1">
          <Label htmlFor="notes" className="text-xs">Notas (opcional)</Label>
          <Textarea
            id="notes"
            value={clientNotes}
            onChange={(e) => setClientNotes(e.target.value)}
            rows={2}
            placeholder="Cualquier detalle inicial del proyecto..."
            disabled={pending}
          />
        </div>

        {/* Visibilidad */}
        <div className="rounded-md border bg-muted/30 p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
              disabled={pending}
              className="mt-0.5 h-4 w-4"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                {hidden
                  ? <><EyeOff className="h-3.5 w-3.5 text-orange-500" /> Oculto al cliente</>
                  : <><Eye className="h-3.5 w-3.5 text-green-600" /> Visible para el cliente</>
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {hidden
                  ? "Este proyecto no aparecerá en el portal del cliente. Útil para servicios internos o proyectos gestionados al margen."
                  : "El cliente verá el proyecto en su portal en cuanto lo crees."}
              </p>
            </div>
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={submit} disabled={pending || !orgId || !serviceId || !propertyAddress.trim()}>
            {pending ? "Creando..." : "Crear solicitud"}
          </Button>
          <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
