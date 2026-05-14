"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { deleteAdminRequest } from "./actions";
import { toast } from "sonner";

interface Props {
  requestId: string;
  referenceCode: string | null;
}

export function DeleteAdminRequestButton({ requestId, referenceCode }: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAdminRequest(requestId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      if (typeof msg === "string" && msg.includes("NEXT_REDIRECT")) return;
      toast.error(msg);
      setDeleting(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive hover:text-white"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        Eliminar proyecto
      </Button>

      <Dialog open={open} onOpenChange={(v) => !deleting && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              ¿Eliminar este proyecto?
            </DialogTitle>
            <DialogDescription className="pt-1">
              <strong className="text-foreground">Esta acción es irreversible.</strong> Se
              eliminarán el proyecto{referenceCode ? ` (${referenceCode})` : ""}, todos sus
              documentos, mensajes, fotos y datos del expediente. No se podrá recuperar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Eliminando..." : "Sí, eliminar proyecto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
