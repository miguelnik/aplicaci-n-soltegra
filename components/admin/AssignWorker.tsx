"use client";

// Componente: Asignar trabajador a una solicitud
// Solo superadmin y admin pueden asignar; el selector muestra admins y superadmins.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Worker {
  id: string;
  full_name: string | null;
  role: string;
}

interface Props {
  requestId: string;
  currentAssignedTo: string | null;
  workers: Worker[];
}

export function AssignWorker({ requestId, currentAssignedTo, workers }: Props) {
  const [assignedTo, setAssignedTo] = useState(currentAssignedTo ?? "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/assign-worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          assignedTo: assignedTo || null,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(`Error: ${result.error}`);
        return;
      }
      toast.success("Asignación actualizada");
      router.refresh();
    } catch {
      toast.error("Error de red al asignar");
    } finally {
      setSaving(false);
    }
  }

  const currentWorker = workers.find((w) => w.id === assignedTo);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          Trabajador asignado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentWorker && (
          <p className="rounded-md bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            Actualmente:{" "}
            <strong className="text-foreground">
              {currentWorker.full_name ?? "Sin nombre"}
            </strong>{" "}
            <span className="opacity-60">
              ({currentWorker.role === "superadmin" ? "Superadmin" : "Admin"})
            </span>
          </p>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Asignar a</Label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Sin asignar —</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.full_name ?? "Sin nombre"}{" "}
                {w.role === "superadmin" ? "(Superadmin)" : "(Admin)"}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar asignación"}
        </Button>
      </CardContent>
    </Card>
  );
}
