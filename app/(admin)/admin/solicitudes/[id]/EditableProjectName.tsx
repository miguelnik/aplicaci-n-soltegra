"use client";

// Nombre del proyecto editable inline en la cabecera de la vista admin.
// Click en el lápiz → input + botón guardar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { updateRequestErp } from "./actions";

interface Props {
  requestId: string;
  initialName: string | null;
}

export function EditableProjectName({ requestId, initialName }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = value.trim();
    if (!trimmed) { toast.error("El nombre no puede estar vacío"); return; }
    startTransition(async () => {
      const res = await updateRequestErp(requestId, { property_address: trimmed });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      setName(trimmed);
      setEditing(false);
      toast.success("Nombre actualizado");
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="flex w-full max-w-xl items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 text-lg font-bold"
          autoFocus
          disabled={pending}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setValue(name); setEditing(false); }
          }}
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={save} disabled={pending}>
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => { setValue(name); setEditing(false); }} disabled={pending}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <h1 className="text-2xl font-bold">{name || "Sin nombre"}</h1>
      <button
        type="button"
        onClick={() => { setValue(name); setEditing(true); }}
        className="text-muted-foreground opacity-60 transition-opacity hover:text-foreground hover:opacity-100"
        title="Editar nombre del proyecto"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
