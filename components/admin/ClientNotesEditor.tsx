"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2 } from "lucide-react";

interface Props {
  requestId: string;
  initialNotes: string | null;
}

export function ClientNotesEditor({ requestId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const initial = initialNotes ?? "";
  const dirty = notes !== initial;
  const router = useRouter();

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/update-client-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, clientNotes: notes }),
      });
      const result = await res.json();
      if (!result.ok) {
        toast.error(`Error: ${result.error}`);
        return;
      }
      toast.success("Mensaje guardado. El cliente lo verá en su panel.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4" />
          Mensaje al cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Visible para el cliente en el detalle de su solicitud. Úsalo para informar de avances, requerimientos, etc."
          className="text-sm"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {dirty ? "Cambios sin guardar" : "Visible por el cliente"}
          </p>
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
