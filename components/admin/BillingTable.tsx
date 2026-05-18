"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import { CheckCircle2, CircleDashed, CreditCard, Loader2 } from "lucide-react";

interface Request {
  id: string;
  reference_code: string | null;
  property_address: string | null;
  status: string;
  is_paid: boolean;
  paid_at: string | null;
  delivered_at: string | null;
  created_at: string;
  price?: number | null;
  is_hidden_from_client?: boolean;
  service_types?: { name: string } | { name: string }[] | null;
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

interface Props {
  requests: Request[];
  orgName: string;
}

export function BillingTable({ requests, orgName }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Solo mostramos solicitudes que no son borradores ni canceladas
  const billable = requests.filter(
    (r) => r.status !== "draft" && r.status !== "cancelled",
  );

  const unpaid = billable.filter((r) => !r.is_paid);
  const paid = billable.filter((r) => r.is_paid);

  // Totales €
  const totalFacturado = billable.reduce((a, r) => a + (r.price ?? 0), 0);
  const totalCobrado   = paid.reduce((a, r) => a + (r.price ?? 0), 0);
  const totalPendiente = unpaid.reduce((a, r) => a + (r.price ?? 0), 0);
  const withoutPrice   = billable.filter((r) => r.price == null).length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllUnpaid() {
    setSelected(new Set(unpaid.map((r) => r.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function markAs(isPaid: boolean) {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/update-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestIds: Array.from(selected), isPaid }),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(`Error: ${result.error}`);
        return;
      }
      toast.success(
        isPaid
          ? `${result.count} certificado${result.count > 1 ? "s" : ""} marcado${result.count > 1 ? "s" : ""} como cobrado${result.count > 1 ? "s" : ""}`
          : `${result.count} certificado${result.count > 1 ? "s" : ""} marcado${result.count > 1 ? "s" : ""} como pendiente${result.count > 1 ? "s" : ""}`,
      );
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSaving(false);
    }
  }

  if (billable.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Facturación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sin certificados facturables todavía.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Facturación — {orgName}
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {paid.length} cobrado{paid.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1 text-orange-600">
              <CircleDashed className="h-3.5 w-3.5" />
              {unpaid.length} pendiente{unpaid.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Acciones en lote */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <span className="text-sm font-medium">
              {selected.size} seleccionado{selected.size > 1 ? "s" : ""}
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAs(true)}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Marcar cobrado
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAs(false)}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleDashed className="h-3.5 w-3.5" />}
                Marcar pendiente
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Botón seleccionar todos los pendientes */}
        {unpaid.length > 0 && selected.size === 0 && (
          <Button size="sm" variant="outline" onClick={selectAllUnpaid}>
            Seleccionar todos los pendientes ({unpaid.length})
          </Button>
        )}

        {/* Tabla */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.size === billable.length && billable.length > 0}
                    onChange={() => {
                      if (selected.size === billable.length) {
                        clearSelection();
                      } else {
                        setSelected(new Set(billable.map((r) => r.id)));
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium">Referencia</th>
                <th className="hidden px-3 py-2 text-left font-medium md:table-cell">Servicio</th>
                <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Dirección</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Importe</th>
                <th className="px-3 py-2 text-left font-medium">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {billable.map((r) => (
                <tr
                  key={r.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                    selected.has(r.id) ? "bg-primary/5" : ""
                  }`}
                  onClick={() => toggleSelect(r.id)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs font-medium">
                    {r.reference_code ?? "—"}
                  </td>
                  <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                    {(() => {
                      const st = r.service_types;
                      if (!st) return "—";
                      const name = Array.isArray(st) ? st[0]?.name : st.name;
                      return name ?? "—";
                    })()}
                  </td>
                  <td className="hidden max-w-[200px] truncate px-3 py-2 text-muted-foreground sm:table-cell">
                    {r.property_address ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status as "submitted"} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                    {r.price != null ? (
                      <span className="font-semibold">{eur(r.price)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Sin precio</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.is_paid ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Cobrado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300">
                        <CircleDashed className="h-3 w-3" />
                        Pendiente
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Resumen económico */}
        <div className="grid gap-2 rounded-lg bg-muted/40 px-4 py-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Facturado total</p>
            <p className="font-mono text-base font-semibold">{eur(totalFacturado)}</p>
            <p className="text-[11px] text-muted-foreground">{billable.length} proyecto{billable.length !== 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cobrado</p>
            <p className="font-mono text-base font-semibold text-green-700">{eur(totalCobrado)}</p>
            <p className="text-[11px] text-muted-foreground">{paid.length} proyecto{paid.length !== 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pendiente</p>
            <p className="font-mono text-base font-semibold text-orange-600">{eur(totalPendiente)}</p>
            <p className="text-[11px] text-muted-foreground">
              {unpaid.length} proyecto{unpaid.length !== 1 ? "s" : ""}
              {withoutPrice > 0 && ` · ${withoutPrice} sin precio`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
