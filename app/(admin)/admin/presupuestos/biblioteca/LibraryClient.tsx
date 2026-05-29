"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createBudgetConcept, updateBudgetConcept, deleteBudgetConcept } from "@/lib/budgets/actions";

interface ConceptRow {
  id: string;
  concept: string;
  description: string | null;
  unit: string | null;
  unit_price: number;
  default_quantity: number;
  service_type_id: string | null;
  is_active: boolean;
  service_name?: string | null;
}

interface Props {
  initial: ConceptRow[];
  services: { id: string; name: string }[];
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

export function LibraryClient({ initial, services }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ConceptRow | null>(null);
  const [open, setOpen] = useState(false);

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(c: ConceptRow) { setEditing(c); setOpen(true); }

  function removeConcept(id: string) {
    if (!confirm("¿Eliminar este concepto?")) return;
    startTransition(async () => {
      const res = await deleteBudgetConcept(id);
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Concepto eliminado");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Conceptos guardados ({initial.length})</CardTitle>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo concepto
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {initial.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin conceptos todavía. Añade los más habituales (visita técnica, registro, redacción…) para tenerlos a un clic en cualquier presupuesto.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Concepto</th>
                  <th className="px-3 py-2 text-left font-medium">Servicio</th>
                  <th className="px-3 py-2 text-right font-medium">Precio</th>
                  <th className="px-3 py-2 text-left font-medium">Ud.</th>
                  <th className="px-3 py-2 text-left font-medium">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {initial.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <p className="font-medium">{c.concept}</p>
                      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.service_name ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{eur(c.unit_price)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.unit ?? "ud"}</td>
                    <td className="px-3 py-2">
                      {c.is_active
                        ? <Badge variant="outline" className="bg-green-50 text-green-700">Activo</Badge>
                        : <Badge variant="outline">Inactivo</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)} disabled={pending}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeConcept(c.id)} disabled={pending}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ConceptDialog
          open={open}
          onOpenChange={setOpen}
          initial={editing}
          services={services}
        />
      </CardContent>
    </Card>
  );
}

function ConceptDialog({
  open, onOpenChange, initial, services,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ConceptRow | null;
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [concept, setConcept] = useState(initial?.concept ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "ud");
  const [unitPrice, setUnitPrice] = useState(initial?.unit_price != null ? String(initial.unit_price) : "");
  const [defaultQuantity, setDefaultQuantity] = useState(initial?.default_quantity != null ? String(initial.default_quantity) : "1");
  const [serviceTypeId, setServiceTypeId] = useState(initial?.service_type_id ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  // Re-init cuando cambia el "initial"
  useState(() => {
    if (initial) {
      setConcept(initial.concept);
      setDescription(initial.description ?? "");
      setUnit(initial.unit ?? "ud");
      setUnitPrice(String(initial.unit_price));
      setDefaultQuantity(String(initial.default_quantity));
      setServiceTypeId(initial.service_type_id ?? "");
      setIsActive(initial.is_active);
    }
  });

  function save() {
    if (!concept.trim()) { toast.error("Falta el concepto"); return; }
    const price = parseFloat(unitPrice);
    if (Number.isNaN(price) || price < 0) { toast.error("Precio inválido"); return; }
    const qty = parseFloat(defaultQuantity);
    if (Number.isNaN(qty) || qty < 0) { toast.error("Cantidad inválida"); return; }

    const payload = {
      concept,
      description: description || null,
      unit: unit || "ud",
      unitPrice: price,
      defaultQuantity: qty,
      serviceTypeId: serviceTypeId || null,
      isActive,
    };

    startTransition(async () => {
      const res = initial
        ? await updateBudgetConcept(initial.id, payload)
        : await createBudgetConcept(payload);
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success(initial ? "Concepto actualizado" : "Concepto creado");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar concepto" : "Nuevo concepto"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Concepto *</Label>
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej: Visita técnica al inmueble" disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={pending} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Cant. por defecto</Label>
              <Input type="number" min="0" step="0.01" value={defaultQuantity} onChange={(e) => setDefaultQuantity(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unidad</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ud, h, m²…" disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio (€) *</Label>
              <Input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} disabled={pending} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Servicio relacionado (opcional)</Label>
            <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Ninguno —</option>
              {services.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
            <p className="text-[11px] text-muted-foreground">Si lo indicas, el concepto aparecerá filtrado al hacer presupuestos de ese servicio.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={pending} className="h-4 w-4" />
            Activo (aparece en el selector)
          </label>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={pending || !concept.trim()}>
            {pending ? "Guardando..." : (initial ? "Guardar" : "Crear")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
