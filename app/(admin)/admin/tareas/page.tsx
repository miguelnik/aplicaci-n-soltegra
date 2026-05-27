import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskItem } from "@/components/admin/TaskItem";
import { NewTaskButton } from "@/components/admin/NewTaskButton";
import { CheckCircle2, ListChecks, AlertCircle, Clock } from "lucide-react";
import { loadPendingFor, loadAllUserTasks } from "@/lib/tasks/dashboard";
import type { PendingItem } from "@/lib/tasks/dashboard";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ scope?: string; showDone?: string }>;
}

export default async function TareasPage({ searchParams }: Props) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const isSuper = me.role === "superadmin";
  const scope = sp.scope === "all" && isSuper ? "all" : "mine";
  const showDone = sp.showDone === "1";

  const admin = createSupabaseAdminClient();

  // Lista de workers para asignar
  const { data: workers } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("role", ["admin", "superadmin"])
    .order("full_name");

  // Cargar items pendientes (tareas + recordatorios oportunidades)
  const pendingItems: PendingItem[] = await loadPendingFor(
    me.id,
    scope === "all" && isSuper,
  );

  // Cargar tareas completadas (sólo si showDone)
  const allTasks = showDone
    ? await loadAllUserTasks(me.id, scope === "all" && isSuper, true)
    : [];
  const completed = allTasks.filter((t) => t.status === "done");

  const overdueCount = pendingItems.filter((p) => p.due_at && new Date(p.due_at).getTime() < Date.now()).length;
  const todayCount = pendingItems.filter((p) => {
    if (!p.due_at) return false;
    const d = new Date(p.due_at);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ListChecks className="h-6 w-6 text-primary" />
            Tareas pendientes
          </h1>
          <p className="text-sm text-muted-foreground">
            {scope === "mine"
              ? "Tus tareas y recordatorios de tus oportunidades."
              : "Vista global de todas las tareas del equipo."}
          </p>
        </div>
        <NewTaskButton currentUserId={me.id} workers={workers ?? []} variant="default" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/admin/tareas"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${scope === "mine" ? "border-primary bg-primary text-white" : "border-border hover:border-primary/50"}`}
        >
          Mis tareas
        </a>
        {isSuper && (
          <a
            href="/admin/tareas?scope=all"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${scope === "all" ? "border-primary bg-primary text-white" : "border-border hover:border-primary/50"}`}
          >
            Todas (superadmin)
          </a>
        )}
        <span className="text-xs text-muted-foreground">·</span>
        <a
          href={`/admin/tareas${scope === "all" ? "?scope=all" : ""}${showDone ? "" : (scope === "all" ? "&showDone=1" : "?showDone=1")}`}
          className="text-xs text-primary hover:underline"
        >
          {showDone ? "Ocultar completadas" : "Ver completadas"}
        </a>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>Pendientes</span>
              <Clock className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold">{pendingItems.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>Hoy</span>
              <Clock className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-amber-600">{todayCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>Vencidas</span>
              <AlertCircle className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-rose-600">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      {pendingItems.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {scope === "mine" ? "¡Sin tareas pendientes!" : "No hay tareas pendientes en el equipo."}
        </p>
      ) : (
        <div className="space-y-2">
          {pendingItems.map((item) => (
            <TaskItem
              key={`${item.source}-${item.id}`}
              item={item}
              showAssignee={scope === "all"}
              canDelete={true}
            />
          ))}
        </div>
      )}

      {/* Completadas */}
      {showDone && completed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Completadas ({completed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completed.map((t) => (
              <div key={t.id} className="rounded-md border bg-muted/30 px-3 py-2 text-sm opacity-75">
                <p className="font-medium line-through">{t.title}</p>
                {t.completed_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Completada {new Date(t.completed_at).toLocaleString("es-ES")}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
