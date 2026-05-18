"use client";

// Formulario standalone de nuevo apunte contable.
// Variante más completa que FinanceEntryForm: incluye selección de cliente y proyecto,
// más auto-rellenado de categoría según el tipo de servicio del proyecto seleccionado.

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createFinanceEntry } from "@/lib/finance/actions";
import {
  INCOME_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  defaultIncomeCategoryForService,
  type FinanceKind,
  type IncomeCategory,
  type ExpenseCategory,
} from "@/lib/finance/types";

interface Org { id: string; name: string }
interface Req {
  id: string;
  reference_code: string | null;
  property_address: string | null;
  organization_id: string;
  service_slug: string | null;
}

interface Props {
  organizations: Org[];
  requests: Req[];
}

export function NewFinanceEntryClient({ organizations, requests }: Props) {
  const router = useRouter();
  const [kind, setKind]               = useState<FinanceKind>("income");
  const [category, setCategory]       = useState<IncomeCategory | ExpenseCategory>("other");
  const [amount, setAmount]           = useState("");
  const [entryDate, setEntryDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [notes, setNotes]             = useState("");
  const [isSettled, setIsSettled]     = useState(false);
  const [orgId, setOrgId]             = useState<string>("");
  const [requestId, setRequestId]     = useState<string>("");
  const [pending, startTransition]    = useTransition();

  // Filtrar proyectos por cliente si está seleccionado
  const filteredRequests = orgId
    ? requests.filter((r) => r.organization_id === orgId)
    : requests;

  // Si seleccionas un proyecto, autocompleta la org y sugiere categoría
  useEffect(() => {
    if (!requestId) return;
    const r = requests.find((x) => x.id === requestId);
    if (!r) return;
    if (orgId !== r.organization_id) setOrgId(r.organization_id);
    if (kind === "income") {
      const cat = defaultIncomeCategoryForService(r.service_slug);
      setCategory(cat);
    }
  }, [requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeKind(k: FinanceKind) {
    setKind(k);
    setCategory("other");
  }

  function submit() {
    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed < 0) { toast.error("Importe inválido"); return; }
    if (!entryDate) { toast.error("Falta la fecha"); return; }

    startTransition(async () => {
      const res = await createFinanceEntry({
        kind,
        category,
        amount: parsed,
        entry_date: entryDate,
        description: description || null,
        notes: notes || null,
        is_settled: isSettled,
        organization_id: orgId || null,
        request_id: requestId || null,
      });

      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Movimiento creado");
      router.push("/admin/contabilidad/movimientos");
    });
  }

  const catOptions = kind === "income"
    ? Object.entries(INCOME_CATEGORY_LABELS) as [IncomeCategory, string][]
    : Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][];

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Nuevo movimiento contable</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tipo */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">Tipo de movimiento</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={kind === "income" ? "default" : "outline"}
              className={kind === "income" ? "bg-green-600 hover:bg-green-700" : ""}
              onClick={() => changeKind("income")}
              disabled={pending}
            >
              Ingreso
            </Button>
            <Button
              size="sm"
              variant={kind === "expense" ? "default" : "outline"}
              className={kind === "expense" ? "bg-orange-600 hover:bg-orange-700" : ""}
              onClick={() => changeKind("expense")}
              disabled={pending}
            >
              Gasto
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Categoría */}
          <div className="space-y-1">
            <Label htmlFor="cat" className="text-xs">Categoría *</Label>
            <select
              id="cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as IncomeCategory | ExpenseCategory)}
              disabled={pending}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {catOptions.map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>

          {/* Importe */}
          <div className="space-y-1">
            <Label htmlFor="amt" className="text-xs">Importe (€) *</Label>
            <Input
              id="amt"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={pending}
            />
          </div>

          {/* Fecha */}
          <div className="space-y-1">
            <Label htmlFor="dt" className="text-xs">Fecha *</Label>
            <Input
              id="dt"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              disabled={pending}
            />
          </div>

          {/* Estado */}
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isSettled}
                onChange={(e) => setIsSettled(e.target.checked)}
                disabled={pending}
                className="h-4 w-4"
              />
              {kind === "income" ? "Cobrado" : "Pagado"}
            </label>
          </div>

          {/* Cliente */}
          <div className="space-y-1">
            <Label htmlFor="org" className="text-xs">Cliente (opcional)</Label>
            <select
              id="org"
              value={orgId}
              onChange={(e) => { setOrgId(e.target.value); setRequestId(""); }}
              disabled={pending}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">— Sin cliente —</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          {/* Proyecto */}
          <div className="space-y-1">
            <Label htmlFor="req" className="text-xs">Proyecto (opcional)</Label>
            <select
              id="req"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              disabled={pending}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">— Sin proyecto —</option>
              {filteredRequests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.reference_code ?? r.id.slice(0, 8)} · {r.property_address ?? "sin dirección"}
                </option>
              ))}
            </select>
            {!orgId && filteredRequests.length > 50 && (
              <p className="text-[11px] text-muted-foreground">
                Selecciona primero un cliente para filtrar.
              </p>
            )}
          </div>
        </div>

        {/* Descripción */}
        <div className="space-y-1">
          <Label htmlFor="desc" className="text-xs">Descripción</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Concepto del movimiento..."
            rows={2}
            disabled={pending}
          />
        </div>

        {/* Notas internas */}
        <div className="space-y-1">
          <Label htmlFor="notes" className="text-xs">Notas internas</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            disabled={pending}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={submit} disabled={pending || !amount}>
            {pending ? "Guardando..." : "Crear movimiento"}
          </Button>
          <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
