"use client";

// Botón "+ Nueva tarea" reutilizable. Abre un Dialog con el formulario.
// Si se le pasa opportunityId/contactId/requestId, la tarea queda vinculada.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createUserTask } from "@/lib/tasks/actions";
import type { TaskPriority } from "@/lib/tasks/types";

interface Worker { id: string; full_name: string | null }

interface Props {
  /** Usuario actual (para selección por defecto del assignee) */
  currentUserId: string;
  /** Lista de workers para asignar (admin/superadmin) */
  workers: Worker[];
  /** Vínculo opcional */
  opportunityId?: string | null;
  contactId?: string | null;
  requestId?: string | null;
  /** Texto del botón. Por defecto "Nueva tarea" */
  label?: string;
  /** Variant del botón */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** size */
  size?: "default" | "sm" | "lg" | "icon";
}

export function NewTaskButton({
  currentUserId, workers,
  opportunityId = null, contactId = null, requestId = null,
  label = "Nueva tarea",
  variant = "outline",
  size = "sm",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setDescription("");
    setAssigneeId(currentUserId);
    setDueDate("");
    setDueTime("");
    setPriority("medium");
  }

  function submit() {
    if (!title.trim()) { toast.error("Falta el título"); return; }

    // Componer due_at desde fecha + hora opcionales
    let dueAt: string | null = null;
    if (dueDate) {
      const t = dueTime || "09:00";
      dueAt = new Date(`${dueDate}T${t}:00`).toISOString();
    }

    startTransition(async () => {
      const res = await createUserTask({
        title,
        description: description || null,
        assigneeId: assigneeId || currentUserId,
        dueAt,
        priority,
        opportunityId,
        contactId,
        requestId,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Tarea creada");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          <Plus className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Qué hay que hacer"
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={pending}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={pending} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Prioridad</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                disabled={pending}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Asignar a</Label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={pending}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name ?? w.id.slice(0,8)}{w.id === currentUserId ? " (yo)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending || !title.trim()}>
            {pending ? "Creando..." : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
