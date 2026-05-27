"use client";

// Editor de líneas de presupuesto/plantilla.
// Devuelve los items vía onChange. Calcula y muestra totales en vivo.

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { computeBudgetTotals } from "@/lib/budgets/types";

export interface EditableItem {
  id?: string;
  concept: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  discount_pct: number;
}

interface Props {
  items: EditableItem[];
  onChange: (items: EditableItem[]) => void;
  vatPct?: number;
  disabled?: boolean;
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

export function BudgetItemsEditor({ items, onChange, vatPct = 21, disabled = false }: Props) {
  function update(idx: number, patch: Partial<EditableItem>) {
    const next = items.map((it, i) => i === idx ? { ...it, ...patch } : it);
    onChange(next);
  }
  function addLine() {
    onChange([...items, {
      concept: "",
      description: null,
      quantity: 1,
      unit: "ud",
      unit_price: 0,
      discount_pct: 0,
    }]);
  }
  function removeLine(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  }

  const totals = useMemo(() => computeBudgetTotals(
    items.map((it, idx) => ({
      id: it.id ?? String(idx),
      budget_id: "",
      position: idx,
      concept: it.concept,
      description: it.description,
      quantity: Number(it.quantity || 0),
      unit: it.unit,
      unit_price: Number(it.unit_price || 0),
      discount_pct: Number(it.discount_pct || 0),
    })),
    vatPct,
  ), [items, vatPct]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-8"></th>
              <th className="px-2 py-2 text-left text-xs font-medium">Concepto *</th>
              <th className="w-20 px-2 py-2 text-right text-xs font-medium">Cant.</th>
              <th className="w-16 px-2 py-2 text-left text-xs font-medium">Ud.</th>
              <th className="w-28 px-2 py-2 text-right text-xs font-medium">Precio</th>
              <th className="w-20 px-2 py-2 text-right text-xs font-medium">Dto %</th>
              <th className="w-28 px-2 py-2 text-right text-xs font-medium">Importe</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Sin partidas. Pulsa &ldquo;Añadir partida&rdquo; para empezar.
                </td>
              </tr>
            ) : items.map((it, idx) => {
              const gross = Number(it.quantity || 0) * Number(it.unit_price || 0);
              const discount = gross * (Number(it.discount_pct || 0) / 100);
              const lineTotal = gross - discount;
              return (
                <tr key={idx} className="align-top">
                  <td className="px-1 py-2 align-middle">
                    <div className="flex flex-col items-center">
                      <button type="button" onClick={() => move(idx, -1)} disabled={disabled || idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Subir">▲</button>
                      <button type="button" onClick={() => move(idx, 1)} disabled={disabled || idx === items.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Bajar">▼</button>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={it.concept}
                      onChange={(e) => update(idx, { concept: e.target.value })}
                      placeholder="Concepto"
                      className="h-8 text-sm"
                      disabled={disabled}
                    />
                    <Input
                      value={it.description ?? ""}
                      onChange={(e) => update(idx, { description: e.target.value || null })}
                      placeholder="Descripción / detalle (opcional)"
                      className="mt-1 h-7 text-xs text-muted-foreground"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number" min="0" step="0.01"
                      value={it.quantity}
                      onChange={(e) => update(idx, { quantity: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-right text-sm"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={it.unit ?? ""}
                      onChange={(e) => update(idx, { unit: e.target.value || "ud" })}
                      placeholder="ud"
                      className="h-8 text-sm"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number" min="0" step="0.01"
                      value={it.unit_price}
                      onChange={(e) => update(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-right text-sm"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number" min="0" max="100" step="1"
                      value={it.discount_pct}
                      onChange={(e) => update(idx, { discount_pct: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-right text-sm"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-sm">{eur(lineTotal)}</td>
                  <td className="px-1 py-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLine(idx)} disabled={disabled}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button variant="outline" size="sm" onClick={addLine} disabled={disabled}>
        <Plus className="h-3.5 w-3.5" />
        Añadir partida
      </Button>

      {/* Totales en vivo */}
      <div className="ml-auto w-full max-w-xs rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">{eur(totals.subtotal)}</span>
        </div>
        {totals.totalDiscount > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Descuentos</span>
            <span className="font-mono">−{eur(totals.totalDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t py-1 pt-2">
          <span className="text-muted-foreground">Base imponible</span>
          <span className="font-mono font-semibold">{eur(totals.base)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted-foreground">IVA ({vatPct}%)</span>
          <span className="font-mono">{eur(totals.vatAmount)}</span>
        </div>
        <div className="mt-1 flex justify-between rounded-md bg-primary px-2 py-2 text-base font-bold text-primary-foreground">
          <span>TOTAL</span>
          <span className="font-mono">{eur(totals.total)}</span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        <GripVertical className="inline h-2.5 w-2.5" /> Usa las flechas para reordenar partidas.
      </p>
    </div>
  );
}
