"use client";

// Tabla de apuntes contables, reutilizable para CRM de cliente y página de
// contabilidad. Permite marcar pagado/pendiente y eliminar inline.

import { useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, CircleDashed, Trash2, ArrowUpRight, ArrowDownRight, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { toggleFinanceEntrySettled, deleteFinanceEntry } from "@/lib/finance/actions";
import {
  INCOME_CATEGORY_LABELS, EXPENSE_CATEGORY_LABELS,
  type FinanceEntry, type IncomeCategory, type ExpenseCategory,
} from "@/lib/finance/types";

interface Props {
  entries: FinanceEntry[];
  /** Si true, muestra columna del proyecto al que va imputado */
  showProject?: boolean;
  /** Mapa request_id → referencia/dirección para mostrar como link */
  projectsById?: Record<string, { reference_code: string | null; property_address: string | null }>;
  /** Mostrar columna de cliente */
  showClient?: boolean;
  /** Mapa org_id → nombre */
  orgsById?: Record<string, string>;
  /** Mensaje si no hay nada */
  emptyText?: string;
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

function categoryLabel(e: FinanceEntry): string {
  if (e.kind === "income") {
    return INCOME_CATEGORY_LABELS[e.category as IncomeCategory] ?? e.category;
  }
  return EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category;
}

export function FinanceEntriesTable({
  entries,
  showProject = false,
  projectsById = {},
  showClient = false,
  orgsById = {},
  emptyText = "Sin movimientos todavía.",
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggleSettled(e: FinanceEntry) {
    setBusyId(e.id);
    startTransition(async () => {
      const res = await toggleFinanceEntrySettled(e.id, !e.is_settled);
      setBusyId(null);
      if (!res.ok) toast.error(res.error ?? "Error");
      else toast.success(e.is_settled ? "Marcado pendiente" : (e.kind === "income" ? "Cobrado" : "Pagado"));
    });
  }

  function remove(id: string) {
    if (!confirm("¿Eliminar este movimiento? Esta acción no se puede deshacer.")) return;
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteFinanceEntry(id);
      setBusyId(null);
      if (!res.ok) toast.error(res.error ?? "Error");
      else toast.success("Movimiento eliminado");
    });
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Fecha</th>
            <th className="px-3 py-2 text-left font-medium">Tipo</th>
            <th className="px-3 py-2 text-left font-medium">Categoría</th>
            <th className="px-3 py-2 text-left font-medium">Concepto</th>
            {showProject && <th className="px-3 py-2 text-left font-medium">Proyecto</th>}
            {showClient && <th className="px-3 py-2 text-left font-medium">Cliente</th>}
            <th className="px-3 py-2 text-right font-medium">Importe</th>
            <th className="px-3 py-2 text-left font-medium">Estado</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((e) => {
            const isIncome = e.kind === "income";
            const proj = e.request_id ? projectsById[e.request_id] : null;
            const orgName = e.organization_id ? orgsById[e.organization_id] : null;
            const busy = busyId === e.id;
            return (
              <tr key={e.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {format(parseISO(e.entry_date), "d MMM yyyy", { locale: es })}
                </td>
                <td className="px-3 py-2">
                  {isIncome ? (
                    <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                      <ArrowDownRight className="h-3 w-3" />
                      Ingreso
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-orange-300 text-orange-700">
                      <ArrowUpRight className="h-3 w-3" />
                      Gasto
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{categoryLabel(e)}</td>
                <td className="max-w-[200px] truncate px-3 py-2">{e.description ?? "—"}</td>
                {showProject && (
                  <td className="px-3 py-2 text-xs">
                    {proj ? (
                      <Link
                        href={`/admin/solicitudes/${e.request_id}`}
                        className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                      >
                        {proj.reference_code ?? "—"}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : "—"}
                  </td>
                )}
                {showClient && (
                  <td className="px-3 py-2 text-xs">
                    {orgName && e.organization_id ? (
                      <Link
                        href={`/admin/clientes/${e.organization_id}`}
                        className="text-primary hover:underline"
                      >
                        {orgName}
                      </Link>
                    ) : "—"}
                  </td>
                )}
                <td className={`px-3 py-2 text-right font-mono font-semibold whitespace-nowrap ${isIncome ? "text-green-700" : "text-orange-700"}`}>
                  {isIncome ? "+" : "−"}{eur(e.amount)}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSettled(e)}
                    disabled={busy}
                    className="text-left disabled:opacity-50"
                  >
                    {e.is_settled ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {isIncome ? "Cobrado" : "Pagado"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-orange-300 text-orange-600">
                        <CircleDashed className="h-3 w-3" />
                        Pendiente
                      </Badge>
                    )}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => remove(e.id)}
                    disabled={busy}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
