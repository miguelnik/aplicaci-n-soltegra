import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskItem } from "@/components/admin/TaskItem";
import { NewTaskButton } from "@/components/admin/NewTaskButton";
import { CheckCircle2, ListChecks, AlertCircle, Clock, CalendarClock, ArrowRight } from "lucide-react";
import { loadPendingFor, loadAllUserTasks } from "@/lib/tasks/dashboard";
import type { PendingItem } from "@/lib/tasks/dashboard";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ scope?: string; showDone?: string }>;
}

function TaskSection({
  title,
  description,
  items,
  showAssignee,
  emptyText,
  tone = "default",
}: {
  title: string;
  description: string;
  items: PendingItem[];
  showAssignee: boolean;
  emptyText: string;
  tone?: "default" | "rose" | "amber";
}) {
  const toneClass = {
    default: "border-border",
    rose: "border-rose-200 bg-rose-50/30",
    amber: "border-amber-200 bg-amber-50/30",
  }[tone];

  return (
    <Card className={toneClass}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {items.length}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed bg-background/60 px-3 py-4 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <TaskItem
                key={`${item.source}-${item.id}`}
                item={item}
                showAssignee={showAssignee}
                canDelete
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
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

  const nowMs = Date.now();
  const nowDate = new Date();
  const tomorrow = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1);
  const tomorrowMs = tomorrow.getTime();
  const overdueItems = pendingItems.filter((p) => p.due_at && new Date(p.due_at).getTime() < nowMs);
  const todayItems = pendingItems.filter((p) => {
    if (!p.due_at) return false;
    const due = new Date(p.due_at).getTime();
    return due >= nowMs && due < tomorrowMs;
  }).length;
  const todayTaskItems = pendingItems.filter((p) => {
    if (!p.due_at) return false;
    const due = new Date(p.due_at).getTime();
    return due >= nowMs && due < tomorrowMs;
  });
  const upcomingItems = pendingItems.filter((p) => {
    if (!p.due_at) return true;
    return new Date(p.due_at).getTime() >= tomorrowMs;
  });
  const focusItem = overdueItems[0] ?? todayTaskItems[0] ?? upcomingItems[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ListChecks className="h-6 w-6 text-primary" />
            Tareas
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
        <Link
          href="/admin/tareas"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${scope === "mine" ? "border-primary bg-primary text-white" : "border-border hover:border-primary/50"}`}
        >
          Mis tareas
        </Link>
        {isSuper && (
          <Link
            href="/admin/tareas?scope=all"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${scope === "all" ? "border-primary bg-primary text-white" : "border-border hover:border-primary/50"}`}
          >
            Todas (superadmin)
          </Link>
        )}
        <span className="text-xs text-muted-foreground">·</span>
        <Link
          href={`/admin/tareas${scope === "all" ? "?scope=all" : ""}${showDone ? "" : (scope === "all" ? "&showDone=1" : "?showDone=1")}`}
          className="text-xs text-primary hover:underline"
        >
          {showDone ? "Ocultar completadas" : "Ver completadas"}
        </Link>
      </div>

      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-3">
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
              <CalendarClock className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-amber-600">{todayItems}</p>
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
            <p className="font-mono text-2xl font-bold text-rose-600">{overdueItems.length}</p>
          </CardContent>
        </Card>
      </div>

      {focusItem && (
        <Link href={focusItem.href} className="block">
          <Card className="border-primary/20 bg-primary text-primary-foreground transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white/70">Siguiente foco</p>
                <p className="font-semibold">{focusItem.title}</p>
                {focusItem.description && (
                  <p className="line-clamp-1 text-sm text-white/75">{focusItem.description}</p>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold">
                Abrir contexto <ArrowRight className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <TaskSection
          title="Vencidas"
          description="Conviene resolverlas primero."
          items={overdueItems}
          showAssignee={scope === "all"}
          emptyText="Nada vencido."
          tone="rose"
        />
        <TaskSection
          title="Hoy"
          description="Trabajo previsto para hoy."
          items={todayTaskItems}
          showAssignee={scope === "all"}
          emptyText="Nada programado para hoy."
          tone="amber"
        />
        <TaskSection
          title="Próximas"
          description="Tareas futuras o sin fecha."
          items={upcomingItems}
          showAssignee={scope === "all"}
          emptyText={scope === "mine" ? "Sin tareas pendientes." : "No hay tareas pendientes en el equipo."}
        />
      </div>

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
