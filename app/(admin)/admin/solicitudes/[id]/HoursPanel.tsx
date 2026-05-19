"use client";

// Panel de imputación de horas del proyecto.
// - Cualquier admin puede imputar sus propias horas
// - El superadmin puede imputar/borrar en nombre de otro trabajador
// - El superadmin además ve el coste asociado a cada apunte

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createTimeEntry, deleteTimeEntry } from "@/lib/hours/actions";
import type { TimeEntryWithWorker } from "@/lib/hours/types";

interface Worker {
  id: string;
  full_name: string | null;
  hourly_cost: number | null;
}

interface Props {
  requestId: string;
  entries: TimeEntryWithWorker[];
  currentUserId: string;
  currentRole: "admin" | "superadmin";
  workers: Worker[];                    // sólo los pasa el server si es superadmin
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});
const h = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} h`;

export function HoursPanel({
  requestId, entries, currentUserId, currentRole, workers,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isSuper = currentRole === "superadmin";
  const totalHours = entries.reduce((a, e) => a + Number(e.hours), 0);
  const totalCost  = entries.reduce(
    (a, e) => a + Number(e.hours) * Number(e.hourly_cost_snapshot ?? 0),
    0,
  );

  function remove(id: string, workerId: string) {
    if (!isSuper && workerId !== currentUserId) {
      toast.error("Sólo el superadmin puede borrar horas de otro trabajador");
      return;
    }
    if (!confirm("¿Eliminar esta imputación de horas?")) return;
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteTimeEntry(id);
      setBusyId(null);
      if (!res.ok) toast.error(res.error ?? "Error");
      else toast.success("Apunte eliminado");
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Horas imputadas
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Total: <span className="font-mono font-semibold text-foreground">{h(totalHours)}</span>
            </span>
            {isSuper && (
              <span className="text-muted-foreground">
                Coste: <span className="font-mono font-semibold text-orange-600">{eur(totalCost)}</span>
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {open ? (
          <NewTimeEntryForm
            requestId={requestId}
            currentUserId={currentUserId}
            isSuper={isSuper}
            workers={workers}
            onDone={() => setOpen(false)}
          />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Imputar horas
          </Button>
        )}

        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Sin horas imputadas al proyecto todavía.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium">Trabajador</th>
                  <th className="px-3 py-2 text-right font-medium">Horas</th>
                  {isSuper && (
                    <>
                      <th className="px-3 py-2 text-right font-medium">€/h</th>
                      <th className="px-3 py-2 text-right font-medium">Coste</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-left font-medium">Descripción</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((e) => {
                  const rate = Number(e.hourly_cost_snapshot ?? 0);
                  const cost = Number(e.hours) * rate;
                  const own = e.worker_id === currentUserId;
                  return (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {format(parseISO(e.entry_date), "d MMM yyyy", { locale: es })}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          {e.worker_name ?? "—"}
                          {own && <Badge variant="outline" className="text-[10px]">Yo</Badge>}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{h(Number(e.hours))}</td>
                      {isSuper && (
                        <>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                            {rate > 0 ? eur(rate) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-orange-700">
                            {cost > 0 ? eur(cost) : "—"}
                          </td>
                        </>
                      )}
                      <td className="max-w-[200px] truncate px-3 py-2 text-xs text-muted-foreground">
                        {e.description ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {(isSuper || own) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => remove(e.id, e.worker_id)}
                            disabled={busyId === e.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Formulario inline para nuevas horas ───────────────────────────────────────

function NewTimeEntryForm({
  requestId, currentUserId, isSuper, workers, onDone,
}: {
  requestId: string;
  currentUserId: string;
  isSuper: boolean;
  workers: Worker[];
  onDone: () => void;
}) {
  const [workerId, setWorkerId]       = useState(currentUserId);
  const [entryDate, setEntryDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours]             = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition]    = useTransition();

  function submit() {
    const parsed = parseFloat(hours);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 24) {
      toast.error("Las horas deben estar entre 0.01 y 24");
      return;
    }
    if (!entryDate) { toast.error("Falta la fecha"); return; }

    startTransition(async () => {
      const res = await createTimeEntry({
        requestId,
        workerId: isSuper && workerId !== currentUserId ? workerId : undefined,
        entryDate,
        hours: parsed,
        description: description || null,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Horas imputadas");
      onDone();
    });
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Imputar horas</p>
        <button type="button" onClick={onDone} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {isSuper && (
          <div className="space-y-1">
            <Label className="text-xs">Trabajador</Label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              disabled={pending}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name ?? "Sin nombre"}{w.id === currentUserId ? " (yo)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
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
          <Label className="text-xs">Horas *</Label>
          <Input
            type="number"
            min="0.25"
            step="0.25"
            max="24"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0.00"
            className="h-8 text-sm"
            disabled={pending}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Descripción (opcional)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="¿Qué hiciste en estas horas?"
          rows={2}
          className="text-sm"
          disabled={pending}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !hours}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>Cancelar</Button>
      </div>
    </div>
  );
}
