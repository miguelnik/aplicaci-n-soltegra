"use client";

// Editor de líneas de presupuesto/plantilla.
// Devuelve los items vía onChange. Calcula y muestra totales en vivo.
// Permite añadir partidas directamente o desde una biblioteca de conceptos.

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Plus, GripVertical, Library, Search } from "lucide-react";
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

export interface LibraryConcept {
  id: string;
  concept: string;
  description: string | null;
  unit: string | null;
  unit_price: number;
  default_quantity: number;
  service_name?: string | null;
}

interface Props {
  items: EditableItem[];
  onChange: (items: EditableItem[]) => void;
  vatPct?: number;
  disabled?: boolean;
  /** Si se pasa, muestra el botón "Añadir desde biblioteca" */
  library?: LibraryConcept[];
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

export function BudgetItemsEditor({ items, onChange, vatPct = 21, disabled = false, library }: Props) {
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
  function addFromLibrary(c: LibraryConcept) {
    onChange([...items, {
      concept: c.concept,
      description: c.description,
      quantity: Number(c.default_quantity ?? 1),
      unit: c.unit ?? "ud",
      unit_price: Number(c.unit_price),
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
                  Sin partidas. Añade desde la biblioteca o crea una en blanco.
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

      {/* Botones de añadir */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={addLine} disabled={disabled}>
          <Plus className="h-3.5 w-3.5" />
          Añadir partida en blanco
        </Button>
        {library && library.length > 0 && (
          <LibraryPicker library={library} onPick={addFromLibrary} disabled={disabled} />
        )}
      </div>

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

// ── Modal selector de biblioteca ─────────────────────────────────────────────

function LibraryPicker({
  library, onPick, disabled,
}: {
  library: LibraryConcept[];
  onPick: (c: LibraryConcept) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return library;
    return library.filter((c) =>
      c.concept.toLowerCase().includes(q)
      || (c.description ?? "").toLowerCase().includes(q)
      || (c.service_name ?? "").toLowerCase().includes(q)
    );
  }, [library, query]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Library className="h-3.5 w-3.5" />
          Añadir desde biblioteca
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Biblioteca de conceptos</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar concepto…"
              className="pl-8"
              autoFocus
            />
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              {library.length === 0
                ? "No hay conceptos en la biblioteca. Añádelos en Presupuestos → Biblioteca."
                : "Sin resultados."}
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className="cursor-pointer rounded-md border bg-card px-3 py-2 transition-colors hover:bg-primary/5 hover:border-primary"
                  onClick={() => { onPick(c); setOpen(false); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{c.concept}</p>
                      {c.description && (
                        <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                      )}
                      {c.service_name && (
                        <p className="mt-0.5 text-[10px] text-primary">{c.service_name}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold">{eur(c.unit_price)}</p>
                      <p className="text-[10px] text-muted-foreground">por {c.unit ?? "ud"}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
