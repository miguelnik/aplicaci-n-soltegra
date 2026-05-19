"use client";

// Formulario global para imputar horas desde /admin/horas.
// Permite seleccionar un proyecto o "Gastos generales" (request_id = null).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { createTimeEntry } from "@/lib/hours/actions";

interface Worker { id: string; full_name: string | null }
interface Project {
  id: string;
  reference_code: string | null;
  property_address: string | null;
  status: string;
}

interface Props {
  currentUserId: string;
  isSuper: boolean;
  workers: Worker[];
  projects: Project[];
}

export function GlobalHoursForm({ currentUserId, isSuper, workers, projects }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workerId, setWorkerId]       = useState(currentUserId);
  const [requestId, setRequestId]     = useState<string>("");  // "" = Gastos generales
  const [entryDate, setEntryDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours]             = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition]    = useTransition();

  function reset() {
    setRequestId("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setHours("");
    setDescription("");
    setWorkerId(currentUserId);
  }

  function submit() {
    const parsed = parseFloat(hours);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 24) {
      toast.error("Las horas deben estar entre 0.01 y 24");
      return;
    }
    if (!entryDate) { toast.error("Falta la fecha"); return; }

    startTransition(async () => {
      const res = await createTimeEntry({
        requestId: requestId || null,
        workerId: isSuper && workerId !== currentUserId ? workerId : undefined,
        entryDate,
        hours: parsed,
        description: description || null,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success(requestId
        ? "Horas imputadas al proyecto"
        : "Horas imputadas como gastos generales");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Imputar horas
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Imputar horas</p>
          <button
            type="button"
            onClick={() => { setOpen(false); reset(); }}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground"
          >
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

          <div className="space-y-1 sm:col-span-2">
            <Label className="flex items-center gap-1.5 text-xs">
              Proyecto
              {!requestId && (
                <Badge variant="outline" className="ml-1 gap-1 text-[10px]">
                  <Briefcase className="h-2.5 w-2.5" />
                  Gastos generales
                </Badge>
              )}
            </Label>
            <select
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              disabled={pending}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Gastos generales (sin proyecto — se prorratea)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.reference_code ?? p.id.slice(0, 8)} · {p.property_address ?? "sin nombre"}
                </option>
              ))}
            </select>
            {!requestId && (
              <p className="text-[11px] text-muted-foreground">
                Estas horas no van a un proyecto concreto. Se reparten por igual entre todos los proyectos activos al calcular su rentabilidad real (administración, comercial, formación…).
              </p>
            )}
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
            placeholder="¿En qué empleaste estas horas?"
            rows={2}
            className="text-sm"
            disabled={pending}
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={pending || !hours}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setOpen(false); reset(); }} disabled={pending}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
