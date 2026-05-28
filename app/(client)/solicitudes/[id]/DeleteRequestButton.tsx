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
import { deleteRequest } from "./actions";
import { toast } from "sonner";
import { isNextControlFlowError } from "@/lib/utils";

interface Props {
  requestId: string;
  isDraft?: boolean;
}

export function DeleteRequestButton({ requestId, isDraft }: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteRequest(requestId);
    } catch (err) {
      if (isNextControlFlowError(err)) throw err;
      const msg = err instanceof Error ? err.message : "Error inesperado";
      toast.error(msg);
      setDeleting(false);
      setOpen(false);
    }
  }

  const label = isDraft ? "Eliminar borrador" : "Eliminar solicitud";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive hover:text-white"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(v: boolean) => !deleting && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {isDraft ? "¿Eliminar este borrador?" : "¿Eliminar esta solicitud?"}
            </DialogTitle>
            <DialogDescription className="pt-1">
              {isDraft ? (
                "Se borrará el borrador y todos sus archivos adjuntos. Esta acción no se puede deshacer."
              ) : (
                <>
                  <strong className="text-foreground">Esta acción es irreversible.</strong> Se
                  eliminarán la solicitud, todos sus archivos adjuntos y el historial de mensajes.
                  No podrás recuperar esta información.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Eliminando..." : isDraft ? "Sí, eliminar borrador" : "Sí, eliminar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
