"use client";

// Botón de borrado de una imputación de horas desde el listado global.
// Aparece para horas propias del worker actual, y siempre para el superadmin.

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTimeEntry } from "@/lib/hours/actions";

interface Props {
  entryId: string;
}

export function DeleteTimeEntryButton({ entryId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function handleClick() {
    if (!confirm("¿Eliminar esta imputación de horas?")) return;
    setBusy(true);
    startTransition(async () => {
      const res = await deleteTimeEntry(entryId);
      setBusy(false);
      if (!res.ok) toast.error(res.error ?? "Error");
      else {
        toast.success("Apunte eliminado");
        router.refresh();
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-destructive"
      onClick={handleClick}
      disabled={pending || busy}
      title="Eliminar"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
