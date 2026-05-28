"use client";

// Editor inline de las notas de un contacto.
// Visible siempre en la página de detalle del contacto, editable con un clic.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Save, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateCrmContact } from "@/lib/crm/actions";

interface Props {
  contactId: string;
  initial: string | null;
}

export function ContactNotesEditor({ contactId, initial }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateCrmContact(contactId, { notes: value || null });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Notas guardadas");
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setValue(initial ?? "");
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <StickyNote className="h-4 w-4 text-amber-500" />
            Notas del contacto
          </CardTitle>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={pending}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={5}
              placeholder="Apunta aquí cualquier información relevante del contacto: preferencias, contexto, historia, etc."
              disabled={pending}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={pending}>
                <Save className="h-3.5 w-3.5" />
                {pending ? "Guardando..." : "Guardar notas"}
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={pending}>
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {value ? (
              <p className="whitespace-pre-line text-sm text-foreground">{value}</p>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="w-full rounded-md border border-dashed bg-muted/20 p-4 text-left text-sm text-muted-foreground hover:bg-muted/30"
              >
                Sin notas. Haz clic para añadir una.
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
