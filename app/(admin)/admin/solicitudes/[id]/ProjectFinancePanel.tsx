"use client";

// Panel de contabilidad imputable a un proyecto concreto.
// Permite contabilizar ingresos/gastos pre-rellenados con el precio del proyecto
// y la categoría adecuada según el servicio.

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, TrendingUp, TrendingDown, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { FinanceEntriesTable } from "@/components/admin/FinanceEntriesTable";
import { createFinanceEntry } from "@/lib/finance/actions";
import {
  INCOME_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  defaultIncomeCategoryForService,
  type FinanceEntry,
  type FinanceKind,
  type IncomeCategory,
  type ExpenseCategory,
} from "@/lib/finance/types";

interface Props {
  requestId: string;
  organizationId: string;
  serviceSlug: string | null;
  price: number | null;
  isPaid: boolean;
  entries: FinanceEntry[];
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

export function ProjectFinancePanel({
  requestId, organizationId, serviceSlug, price, isPaid, entries,
}: Props) {
  const [mode, setMode] = useState<"closed" | "income" | "expense">("closed");

  // Pre-cálculos
  const totalIncome  = entries.filter((e) => e.kind === "income").reduce((a, e) => a + Number(e.amount), 0);
  const totalExpense = entries.filter((e) => e.kind === "expense").reduce((a, e) => a + Number(e.amount), 0);
  const balance      = totalIncome - totalExpense;
  const hasIncomeFromPrice = entries.some(
    (e) => e.kind === "income" && Math.abs(Number(e.amount) - (price ?? 0)) < 0.01,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            Contabilidad del proyecto
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Ingresos: <span className="font-mono font-semibold text-green-700">{eur(totalIncome)}</span>
            </span>
            <span className="text-muted-foreground">
              Gastos: <span className="font-mono font-semibold text-orange-600">{eur(totalExpense)}</span>
            </span>
            <span className="text-muted-foreground">
              Balance: <span className={`font-mono font-semibold ${balance >= 0 ? "text-green-700" : "text-red-600"}`}>{eur(balance)}</span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Aviso si el proyecto tiene precio y aún no se ha contabilizado */}
        {price != null && price > 0 && !hasIncomeFromPrice && (
          <div className="flex items-start gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Este proyecto tiene un precio asignado de <strong>{eur(price)}</strong> pero todavía no se ha registrado el ingreso. Pulsa <em>Contabilizar ingreso</em> para registrarlo en la contabilidad.
            </span>
          </div>
        )}

        {/* Acciones */}
        {mode === "closed" && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => setMode("income")}
              className="bg-green-600 hover:bg-green-700"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Contabilizar ingreso
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMode("expense")}
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Contabilizar gasto
            </Button>
          </div>
        )}

        {/* Formulario inline */}
        {mode !== "closed" && (
          <InlineForm
            kind={mode}
            requestId={requestId}
            organizationId={organizationId}
            serviceSlug={serviceSlug}
            suggestedAmount={mode === "income" && price ? price : undefined}
            suggestedSettled={mode === "income" ? isPaid : false}
            onDone={() => setMode("closed")}
          />
        )}

        {/* Tabla de movimientos */}
        <FinanceEntriesTable
          entries={entries}
          emptyText="Sin movimientos imputados a este proyecto. Pulsa los botones de arriba para registrar el primero."
        />
      </CardContent>
    </Card>
  );
}

// ── Form inline ───────────────────────────────────────────────────────────────

function InlineForm({
  kind, requestId, organizationId, serviceSlug,
  suggestedAmount, suggestedSettled, onDone,
}: {
  kind: FinanceKind;
  requestId: string;
  organizationId: string;
  serviceSlug: string | null;
  suggestedAmount?: number;
  suggestedSettled?: boolean;
  onDone: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [category, setCategory]       = useState<IncomeCategory | ExpenseCategory>(
    kind === "income"
      ? defaultIncomeCategoryForService(serviceSlug)
      : "other",
  );
  const [amount, setAmount]           = useState(suggestedAmount != null ? String(suggestedAmount) : "");
  const [entryDate, setEntryDate]     = useState(today);
  const [description, setDescription] = useState("");
  const [isSettled, setIsSettled]     = useState(suggestedSettled ?? false);
  const [pending, startTransition]    = useTransition();

  function submit() {
    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed < 0) { toast.error("Importe inválido"); return; }

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
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success(kind === "income" ? "Ingreso contabilizado" : "Gasto contabilizado");
      onDone();
    });
  }

  const opts = kind === "income"
    ? Object.entries(INCOME_CATEGORY_LABELS) as [IncomeCategory, string][]
    : Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][];

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Nuevo {kind === "income" ? "ingreso" : "gasto"} imputable al proyecto
        </p>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Categoría</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as IncomeCategory | ExpenseCategory)}
            disabled={pending}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {opts.map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Importe (€) *</Label>
          <Input
            type="number" min="0" step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="h-8 text-sm"
            disabled={pending}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Fecha *</Label>
          <Input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="h-8 text-sm"
            disabled={pending}
          />
        </div>

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

      <div className="space-y-1">
        <Label className="text-xs">Descripción (opcional)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="text-sm"
          disabled={pending}
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !amount}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
