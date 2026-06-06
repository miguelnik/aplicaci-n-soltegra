"use client";

// Diálogo reutilizable para editar una tarea existente.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { updateUserTask } from "@/lib/tasks/actions";
import type { TaskPriority } from "@/lib/tasks/types";

interface Worker { id: string; full_name: string | null }

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  due_at: string | null;
  priority: TaskPriority;
}

interface Props {
  task: TaskData;
  workers: Worker[];
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTaskDialog({ task, workers, currentUserId, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Parsear due_at en fecha y hora separadas
  const initialDate = task.due_at ? task.due_at.slice(0, 10) : "";
  const initialTime = task.due_at
    ? new Date(task.due_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "";

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [dueDate, setDueDate] = useState(initialDate);
  const [dueTime, setDueTime] = useState(initialTime);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);

  function submit() {
    if (!title.trim()) { toast.error("Falta el título"); return; }

    let dueAt: string | null = null;
    if (dueDate) {
      const t = dueTime || "09:00";
      dueAt = new Date(`${dueDate}T${t}:00`).toISOString();
    }

    startTransition(async () => {
      const res = await updateUserTask(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        assigneeId,
        dueAt,
        priority,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Tarea actualizada");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar tarea</DialogTitle>
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
                    {w.full_name ?? w.id.slice(0, 8)}{w.id === currentUserId ? " (yo)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || !title.trim()}>
            {pending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
