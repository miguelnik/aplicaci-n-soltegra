"use client";

// Formulario inline para crear un apunte contable (ingreso o gasto).
// Reutilizable: se le puede pre-rellenar organization_id y/o request_id.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createFinanceEntry } from "@/lib/finance/actions";
import {
  INCOME_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  type FinanceKind,
  type IncomeCategory,
  type ExpenseCategory,
} from "@/lib/finance/types";

interface Props {
  /** Cliente al que se imputa el apunte (opcional) */
  organizationId?: string | null;
  /** Proyecto al que se imputa el apunte (opcional) */
  requestId?: string | null;
  /** Tipo fijo si solo queremos ingresos o solo gastos */
  fixedKind?: FinanceKind;
  /** Texto del botón de apertura */
  triggerLabel?: string;
  /** Layout: 'inline' renderiza directamente sin botón; 'card' usa apertura/cierre */
  variant?: "inline" | "card";
  /** Categoría sugerida por defecto */
  defaultCategory?: IncomeCategory | ExpenseCategory;
  /** Importe sugerido por defecto */
  defaultAmount?: number;
}

export function FinanceEntryForm({
  organizationId = null,
  requestId = null,
  fixedKind,
  triggerLabel = "Añadir movimiento",
  variant = "card",
  defaultCategory,
  defaultAmount,
}: Props) {
  const [open, setOpen] = useState(variant === "inline");
  const [kind, setKind]               = useState<FinanceKind>(fixedKind ?? "income");
  const [category, setCategory]       = useState<IncomeCategory | ExpenseCategory>(
    defaultCategory ?? (fixedKind === "expense" ? "other" : "other")
  );
  const [amount, setAmount]           = useState(defaultAmount != null ? String(defaultAmount) : "");
  const [entryDate, setEntryDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [isSettled, setIsSettled]     = useState(false);
  const [pending, startTransition]    = useTransition();

  function resetForm() {
    setKind(fixedKind ?? "income");
    setCategory(defaultCategory ?? "other");
    setAmount("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setIsSettled(false);
  }

  function changeKind(k: FinanceKind) {
    setKind(k);
    // Reset category to a valid one for the new kind
    setCategory(k === "income" ? "other" : "other");
  }

  function submit() {
    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Importe inválido");
      return;
    }
    if (!entryDate) {
      toast.error("Falta la fecha");
      return;
    }

    startTransition(async () => {
      const res = await createFinanceEntry({
        kind,
        category,
        amount: parsed,
        entry_date: entryDate,
        description: description || null,
        is_settled: isSettled,
        organization_id: organizationId,
        request_id: requestId,
      });

      if (!res.ok) {
        toast.error(res.error ?? "Error al guardar");
        return;
      }
      toast.success(kind === "income" ? "Ingreso registrado" : "Gasto registrado");
      resetForm();
      if (variant === "card") setOpen(false);
    });
  }

  // ── Render del botón cerrado (solo card variant) ────────────────────────────
  if (!open && variant === "card") {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        {triggerLabel}
      </Button>
    );
  }

  const categoryOptions = kind === "income"
    ? Object.entries(INCOME_CATEGORY_LABELS) as [IncomeCategory, string][]
    : Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][];

  // ── Form ───────────────────────────────────────────────────────────────────
  const inner = (
    <div className="space-y-3">
      {/* Tipo (income/expense) */}
      {!fixedKind && (
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
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Categoría */}
        <div className="space-y-1">
          <Label htmlFor="fe-cat" className="text-xs">Categoría</Label>
          <select
            id="fe-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as IncomeCategory | ExpenseCategory)}
            disabled={pending}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {categoryOptions.map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>

        {/* Importe */}
        <div className="space-y-1">
          <Label htmlFor="fe-amount" className="text-xs">Importe (€) *</Label>
          <Input
            id="fe-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="h-8 text-sm"
            disabled={pending}
          />
        </div>

        {/* Fecha */}
        <div className="space-y-1">
          <Label htmlFor="fe-date" className="text-xs">Fecha *</Label>
          <Input
            id="fe-date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="h-8 text-sm"
            disabled={pending}
          />
        </div>

        {/* Settled */}
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <label className="flex h-8 items-center gap-2 text-sm">
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
      </div>

      {/* Descripción */}
      <div className="space-y-1">
        <Label htmlFor="fe-desc" className="text-xs">Descripción</Label>
        <Textarea
          id="fe-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Concepto del movimiento..."
          rows={2}
          className="text-sm"
          disabled={pending}
        />
      </div>

      {/* Acciones */}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !amount}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        {variant === "card" && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );

  if (variant === "inline") return inner;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Nuevo movimiento</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
            disabled={pending}
          >
            <X className="h-4 w-4" />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}
