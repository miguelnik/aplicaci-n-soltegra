"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateStatus } from "./actions";

const STATUSES = [
  { value: "submitted", label: "Nueva" },
  { value: "in_review", label: "En revisión" },
  { value: "in_progress", label: "En redacción" },
  { value: "awaiting_info", label: "Pendiente de info" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
];

interface Props {
  requestId: string;
  currentStatus: string;
}

export function StatusChanger({ requestId, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateStatus(requestId, status, deliveryDate, notes);
      if (!result.ok) {
        toast.error(`Error: ${result.error}`);
        return;
      }
      toast.success(status === "delivered" ? "Estado actualizado. Cliente notificado." : "Estado actualizado");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error inesperado: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Cambiar estado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Estado</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Fecha prevista de entrega</Label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notas internas</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Visible solo para admin..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Actualizar estado"}
        </Button>
      </CardContent>
    </Card>
  );
}
