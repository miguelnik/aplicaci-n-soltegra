"use client";

// Componente: Cambiar la fase actual de un proyecto (según fases configuradas en el servicio)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Phase {
  key: string;
  label: string;
  description?: string;
}

interface Props {
  requestId: string;
  currentPhaseKey: string | null;
  phases: Phase[];
}

export function PhaseChanger({ requestId, currentPhaseKey, phases }: Props) {
  const [phaseKey, setPhaseKey] = useState(currentPhaseKey ?? "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/update-phase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, phaseKey: phaseKey || null }),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(`Error: ${result.error}`);
        return;
      }
      toast.success("Fase actualizada");
      router.refresh();
    } catch {
      toast.error("Error de red al actualizar la fase");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          Fase del proyecto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Fase actual (visible al cliente)</Label>
          <select
            value={phaseKey}
            onChange={(e) => setPhaseKey(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Sin fase activa —</option>
            {phases.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          {phaseKey && phases.find((p) => p.key === phaseKey)?.description && (
            <p className="text-xs text-muted-foreground">
              {phases.find((p) => p.key === phaseKey)!.description}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Actualizar fase"}
        </Button>
      </CardContent>
    </Card>
  );
}
