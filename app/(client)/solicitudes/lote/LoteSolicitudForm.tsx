"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ServiceOption {
  id: string;
  slug: string;
  name: string;
  schemaId: string;
  titleFieldKey: string;
  titleFieldLabel: string;
}

interface Props {
  organizationId: string;
  profileId: string;
  services: ServiceOption[];
}

export function LoteSolicitudForm({ organizationId, profileId, services }: Props) {
  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? "");
  const [values, setValues] = useState<string[]>([""]);
  const [sending, setSending] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const selectedService = services.find((s) => s.id === serviceId);

  function addRow() {
    setValues((prev) => [...prev, ""]);
  }

  function removeRow(idx: number) {
    setValues((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, value: string) {
    setValues((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  function handlePaste(idx: number, text: string) {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) return;
    setValues((prev) => {
      const next = [...prev];
      next.splice(idx, 1, ...lines);
      return next;
    });
  }

  async function handleSubmit() {
    const valid = values.map((a) => a.trim()).filter(Boolean);
    if (valid.length === 0) {
      toast.error(`Añade al menos un valor de "${selectedService?.titleFieldLabel ?? "título"}"`);
      return;
    }

    if (!selectedService) {
      toast.error("Selecciona un servicio");
      return;
    }

    setSending(true);

    const titleKey = selectedService.titleFieldKey;
    const rows = valid.map((value) => ({
      organization_id: organizationId,
      created_by: profileId,
      form_schema_id: selectedService.schemaId,
      service_type_id: selectedService.id,
      form_data: { [titleKey]: value },
      property_address: value,
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

  const validCount = values.filter((a) => a.trim()).length;
  const fieldLabel = selectedService?.titleFieldLabel ?? "Valor";

  return (
    <div className="space-y-4">
      {services.length > 1 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <Label htmlFor="service">Tipo de servicio</Label>
            <select
              id="service"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setValues([""]);
              }}
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
          <Label>{fieldLabel}</Label>
          <p className="text-xs text-muted-foreground">
            Un valor por fila. También puedes pegar varias líneas de golpe.
          </p>
          {values.map((val, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={val}
                onChange={(e) => updateRow(idx, e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (text.includes("\n")) {
                    e.preventDefault();
                    handlePaste(idx, text);
                  }
                }}
                placeholder={`${fieldLabel} ${idx + 1}`}
              />
              {values.length > 1 && (
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
            Añadir fila
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {validCount} {validCount === 1 ? "solicitud" : "solicitudes"} · se crearán como borradores
        </p>
        <Button onClick={handleSubmit} disabled={sending || validCount === 0}>
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          {sending ? "Creando..." : `Crear ${validCount} ${validCount === 1 ? "solicitud" : "solicitudes"}`}
        </Button>
      </div>
    </div>
  );
}
