"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ServiceOption {
  id: string;
  slug: string;
  name: string;
  schemaId: string;
}

interface Props {
  organizationId: string;
  profileId: string;
  services: ServiceOption[];
}

export function LoteSolicitudForm({ organizationId, profileId, services }: Props) {
  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? "");
  const [addresses, setAddresses] = useState<string[]>([""]);
  const [sending, setSending] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  function addRow() {
    setAddresses((prev) => [...prev, ""]);
  }

  function removeRow(idx: number) {
    setAddresses((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, value: string) {
    setAddresses((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  function handlePaste(idx: number, text: string) {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) return;
    setAddresses((prev) => {
      const next = [...prev];
      next.splice(idx, 1, ...lines);
      return next;
    });
  }

  async function handleSubmit() {
    const valid = addresses.map((a) => a.trim()).filter(Boolean);
    if (valid.length === 0) {
      toast.error("Añade al menos una dirección");
      return;
    }

    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      toast.error("Selecciona un servicio");
      return;
    }

    setSending(true);

    const rows = valid.map((addr) => ({
      organization_id: organizationId,
      created_by: profileId,
      form_schema_id: service.schemaId,
      service_type_id: service.id,
      form_data: { direccion: addr },
      property_address: addr,
      status: "draft" as const,
    }));

    const { data, error } = await supabase
      .from("certificate_requests")
      .insert(rows)
      .select("id");

    if (error) {
      toast.error("Error al crear las solicitudes: " + error.message);
      setSending(false);
      return;
    }

    toast.success(`${data.length} solicitud${data.length > 1 ? "es" : ""} creada${data.length > 1 ? "s" : ""} como borrador`);
    router.push("/dashboard?status=draft");
  }

  const validCount = addresses.filter((a) => a.trim()).length;

  return (
    <div className="space-y-4">
      {services.length > 1 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <Label htmlFor="service">Tipo de servicio</Label>
            <select
              id="service"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Todas las solicitudes en este lote se crearán para este servicio.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 pt-6">
          <Label>Direcciones</Label>
          <p className="text-xs text-muted-foreground">
            Una dirección por fila. También puedes pegar varias líneas de golpe.
          </p>
          {addresses.map((addr, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={addr}
                onChange={(e) => updateRow(idx, e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (text.includes("\n")) {
                    e.preventDefault();
                    handlePaste(idx, text);
                  }
                }}
                placeholder={`Dirección ${idx + 1} — ej. C/ Gran Vía 15, 3ºA, Granada`}
              />
              {addresses.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" type="button" onClick={addRow}>
            <Plus className="h-4 w-4" />
            Añadir dirección
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {validCount} dirección{validCount !== 1 ? "es" : ""} · se crearán como borradores
        </p>
        <Button onClick={handleSubmit} disabled={sending || validCount === 0}>
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          {sending ? "Creando..." : `Crear ${validCount} solicitud${validCount !== 1 ? "es" : ""}`}
        </Button>
      </div>
    </div>
  );
}
