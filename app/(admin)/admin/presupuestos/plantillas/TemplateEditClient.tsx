"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";
import { createBudgetTemplate, updateBudgetTemplate, deleteBudgetTemplate } from "@/lib/budgets/actions";
import { BudgetItemsEditor, type EditableItem } from "@/components/admin/BudgetItemsEditor";

interface TemplateInitial {
  id: string;
  name: string;
  description: string | null;
  service_type_id: string | null;
  is_active: boolean;
}

interface Props {
  initial?: TemplateInitial;
  initialItems?: EditableItem[];
  services: { id: string; name: string }[];
}

export function TemplateEditClient({ initial, initialItems = [], services }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [serviceTypeId, setServiceTypeId] = useState(initial?.service_type_id ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [items, setItems] = useState<EditableItem[]>(initialItems);

  function save() {
    if (!name.trim()) { toast.error("Falta el nombre"); return; }
    const payload = {
      name,
      description: description || null,
      serviceTypeId: serviceTypeId || null,
      isActive,
      items: items
        .filter((it) => it.concept.trim())
        .map((it) => ({
          concept: it.concept,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unit_price,
          discountPct: it.discount_pct,
        })),
    };

    startTransition(async () => {
      const res = initial
        ? await updateBudgetTemplate(initial.id, payload)
        : await createBudgetTemplate(payload);
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success(initial ? "Plantilla guardada" : "Plantilla creada");
      if (!initial && "id" in res && res.id) {
        router.push(`/admin/presupuestos/plantillas/${res.id}`);
      } else {
        router.refresh();
      }
    });
  }

  function remove() {
    if (!initial) return;
    if (!confirm("¿Eliminar esta plantilla?")) return;
    startTransition(async () => {
      const res = await deleteBudgetTemplate(initial.id);
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Plantilla eliminada");
      router.push("/admin/presupuestos/plantillas");
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Datos de la plantilla</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Certificado Energético vivienda" disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={pending} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Servicio relacionado (opcional)</Label>
              <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Ninguno —</option>
                {services.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input id="active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={pending} className="h-4 w-4" />
              <Label htmlFor="active" className="text-sm">Activa (aparece al crear presupuestos)</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Partidas</CardTitle></CardHeader>
        <CardContent>
          <BudgetItemsEditor items={items} onChange={setItems} disabled={pending} />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={save} disabled={pending || !name.trim()}>
          <Save className="h-3.5 w-3.5" />
          {pending ? "Guardando..." : (initial ? "Guardar cambios" : "Crear plantilla")}
        </Button>
        {initial && (
          <Button variant="ghost" onClick={remove} disabled={pending} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        )}
      </div>
    </div>
  );
}
