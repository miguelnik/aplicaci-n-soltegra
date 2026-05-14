"use client";

// Editor de fases del proyecto para la configuración de servicio.
// Permite añadir, editar, reordenar y eliminar las fases que verá el cliente
// en el módulo de estado/timeline de su portal.

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface StatusPhase {
  key: string;
  label: string;
  description?: string;
}

interface Props {
  serviceId: string;
  initialPhases: StatusPhase[];
}

function generateKey(label: string, existing: StatusPhase[]): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
  let key = base || `fase_${existing.length + 1}`;
  let i = 2;
  while (existing.some((p) => p.key === key)) {
    key = `${base}_${i++}`;
  }
  return key;
}

export function StatusPhasesEditor({ serviceId, initialPhases }: Props) {
  const [phases, setPhases] = useState<StatusPhase[]>(initialPhases);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");

  function addPhase() {
    const label = newLabel.trim();
    if (!label) {
      toast.error("Escribe el nombre de la fase");
      return;
    }
    const key = generateKey(label, phases);
    setPhases((prev) => [...prev, { key, label, description: newDesc.trim() || undefined }]);
    setNewLabel("");
    setNewDesc("");
  }

  function removePhase(key: string) {
    setPhases((prev) => prev.filter((p) => p.key !== key));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setPhases((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    if (index === phases.length - 1) return;
    setPhases((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function updatePhaseLabel(key: string, label: string) {
    setPhases((prev) =>
      prev.map((p) => (p.key === key ? { ...p, label } : p)),
    );
  }

  function updatePhaseDesc(key: string, description: string) {
    setPhases((prev) =>
      prev.map((p) =>
        p.key === key ? { ...p, description: description || undefined } : p,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/service-phases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, phases }),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(`Error: ${result.error}`);
        return;
      }
      toast.success("Fases guardadas correctamente");
    } catch {
      toast.error("Error de red al guardar las fases");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fases del proyecto</CardTitle>
        <p className="text-sm text-muted-foreground">
          Define las fases que el cliente verá en el timeline de estado de su portal.
          Si no configuras fases, se usará el timeline genérico.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de fases existentes */}
        {phases.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
            Sin fases configuradas — el portal usará el timeline genérico.
          </p>
        )}

        <ul className="space-y-2">
          {phases.map((phase, i) => (
            <li
              key={phase.key}
              className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3"
            >
              {/* Icono de orden */}
              <span className="mt-2.5 shrink-0 text-muted-foreground/40">
                <GripVertical className="h-4 w-4" />
              </span>

              {/* Campos editables */}
              <div className="flex-1 space-y-1.5">
                <Input
                  value={phase.label}
                  onChange={(e) => updatePhaseLabel(phase.key, e.target.value)}
                  placeholder="Nombre de la fase"
                  className="h-8 text-sm"
                />
                <Input
                  value={phase.description ?? ""}
                  onChange={(e) => updatePhaseDesc(phase.key, e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="h-7 text-xs text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground/60">clave: {phase.key}</p>
              </div>

              {/* Botones orden + eliminar */}
              <div className="flex shrink-0 flex-col gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  title="Subir"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveDown(i)}
                  disabled={i === phases.length - 1}
                  title="Bajar"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => removePhase(phase.key)}
                  title="Eliminar fase"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {/* Añadir nueva fase */}
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground">Nueva fase</p>
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Nombre de la fase *"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addPhase()}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addPhase}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Descripción (opcional)"
            className="h-7 text-xs"
          />
        </div>

        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar fases"}
        </Button>
      </CardContent>
    </Card>
  );
}
