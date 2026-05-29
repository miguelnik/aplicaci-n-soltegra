"use client";

// Panel de tareas vinculadas a un proyecto.
// Las tareas creadas desde aquí quedan auto-asociadas al proyecto (request_id).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks } from "lucide-react";
import { NewTaskButton } from "@/components/admin/NewTaskButton";
import { TaskItem } from "@/components/admin/TaskItem";
import type { PendingItem } from "@/lib/tasks/dashboard";

interface RawTask {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: "low" | "medium" | "high";
  status: string;
  assignee_id: string;
  contact_id: string | null;
  request_id: string | null;
  assignee_name: string | null;
  creator_name: string | null;
}

interface Props {
  requestId: string;
  currentUserId: string;
  workers: { id: string; full_name: string | null }[];
  tasks: RawTask[];
}

export function ProjectTasksPanel({ requestId, currentUserId, workers, tasks }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" />
            Tareas del proyecto
          </CardTitle>
          <NewTaskButton
            currentUserId={currentUserId}
            workers={workers}
            requestId={requestId}
          />
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin tareas vinculadas. Crea una con el botón de arriba — quedará asociada a este proyecto.
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => {
              const item: PendingItem = {
                source: "task",
                id: t.id,
                title: t.title,
                description: t.description,
                due_at: t.due_at,
                priority: t.priority,
                assignee_id: t.assignee_id,
                assignee_name: t.assignee_name,
                creator_name: t.creator_name,
                href: `/admin/solicitudes/${requestId}`,
                opportunity_id: null,
                contact_id: t.contact_id,
                request_id: t.request_id,
                status: t.status === "done" ? "done" : "pending",
              };
              return <TaskItem key={t.id} item={item} showAssignee canDelete />;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
