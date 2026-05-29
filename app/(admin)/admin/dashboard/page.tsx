import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  ListChecks,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import { TaskItem } from "@/components/admin/TaskItem";
import { TaskNotifier } from "@/components/admin/TaskNotifier";
import { ACTIVE_STAGES, STAGE_LABEL, type OpportunityStage } from "@/lib/crm/types";
import { computePnl, filterByDateRange } from "@/lib/finance/pnl";
import type { FinanceEntry } from "@/lib/finance/types";
import type { TimeEntry } from "@/lib/hours/types";
import { loadPendingFor, type PendingItem } from "@/lib/tasks/dashboard";

export const dynamic = "force-dynamic";

type DashboardPeriod = "month" | "quarter" | "year" | "last12";

interface DashboardSearchParams {
  period?: string;
}

interface DashboardProps {
  searchParams?: Promise<DashboardSearchParams>;
}

type OpportunityRow = {
  id: string;
  title: string;
  stage: OpportunityStage;
  estimated_value: number | string | null;
  probability: number | null;
  next_action: string | null;
  next_action_due: string | null;
  won_at: string | null;
  lost_at: string | null;
  updated_at: string;
};

type ProjectRow = {
  id: string;
  status: string;
  assigned_to: string | null;
  property_address: string | null;
  reference_code: string | null;
  created_at: string;
  client_deadline: string | null;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
};

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "month", label: "Mes actual" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Año" },
  { value: "last12", label: "Últimos 12 meses" },
];

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function resolvePeriod(rawPeriod?: string) {
  const now = new Date();
  const period = PERIOD_OPTIONS.some((o) => o.value === rawPeriod)
    ? (rawPeriod as DashboardPeriod)
    : "month";

  if (period === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const from = new Date(now.getFullYear(), quarterStartMonth, 1);
    const to = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return {
      period,
      from: toIsoDate(from),
      to: toIsoDate(to),
      label: `T${quarter} ${now.getFullYear()}`,
    };
  }

  if (period === "year") {
    return {
      period,
      from: `${now.getFullYear()}-01-01`,
      to: `${now.getFullYear()}-12-31`,
      label: `${now.getFullYear()}`,
    };
  }

  if (period === "last12") {
    const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return {
      period,
      from: toIsoDate(from),
      to: toIsoDate(now),
      label: "Últimos 12 meses",
    };
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    period,
    from: toIsoDate(from),
    to: toIsoDate(to),
    label: from.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
  };
}

function isDateInRange(value: string | null, from: string, to: string): boolean {
  if (!value) return false;
  const date = value.slice(0, 10);
  return date >= from && date <= to;
}

function splitTasks(items: PendingItem[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

  const overdue = items.filter((p) => p.due_at && new Date(p.due_at).getTime() < todayStart);
  const today = items.filter((p) => {
    if (!p.due_at) return false;
    const time = new Date(p.due_at).getTime();
    return time >= todayStart && time < tomorrowStart;
  });
  const upcoming = items
    .filter((p) => !p.due_at || new Date(p.due_at).getTime() >= tomorrowStart)
    .slice(0, 8);

  return { overdue, today, upcoming };
}

function SummaryCard({
  title,
  value,
  detail,
  href,
  tone = "default",
}: {
  title: string;
  value: string | number;
  detail?: string;
  href?: string;
  tone?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass = {
    default: "text-foreground",
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-rose-700",
    blue: "text-blue-700",
  }[tone];

  const content = (
    <Card className={href ? "h-full transition-shadow hover:shadow-md" : "h-full"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function PeriodSelector({ active }: { active: DashboardPeriod }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PERIOD_OPTIONS.map((option) => {
        const isActive = option.value === active;
        return (
          <Link
            key={option.value}
            href={`/admin/dashboard?period=${option.value}`}
            className={[
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

async function OperationalDashboard({ me }: { me: { id: string } }) {
  const supabase = await createSupabaseServerClient();

  const pendingItems = await loadPendingFor(me.id, false);
  const { overdue, today } = splitTasks(pendingItems);
  const upcoming = pendingItems.slice(0, 8);

  const { data: counts } = await supabase
    .from("certificate_requests")
    .select("status")
    .not("status", "in", '("draft","cancelled")');

  const submitted = counts?.filter((r) => r.status === "submitted").length ?? 0;
  const inReview = counts?.filter((r) => r.status === "in_review").length ?? 0;
  const inProgress = counts?.filter((r) => r.status === "in_progress").length ?? 0;
  const delivered = counts?.filter((r) => r.status === "delivered").length ?? 0;

  const { data: msgRows } = await supabase
    .from("request_messages")
    .select("request_id, author_role, created_at")
    .order("created_at", { ascending: false });

  const latestByRequest = new Map<string, string>();
  for (const m of msgRows ?? []) {
    if (!latestByRequest.has(m.request_id)) latestByRequest.set(m.request_id, m.author_role);
  }
  const requestsWithClientMessages = new Set(
    Array.from(latestByRequest.entries())
      .filter(([, role]) => role === "client")
      .map(([id]) => id),
  );

  const { data: recent } = await supabase
    .from("certificate_requests")
    .select(`
      id, status, property_address, reference_code, created_at, estimated_delivery_date,
      organizations(name)
    `)
    .not("status", "in", '("draft","cancelled")')
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-6">
      <TaskNotifier items={pendingItems} />

      <h1 className="text-2xl font-bold">Dashboard</h1>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-primary" />
              Tareas pendientes
              {overdue.length > 0 && (
                <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  {overdue.length} vencida{overdue.length > 1 ? "s" : ""}
                </span>
              )}
              {today.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  {today.length} hoy
                </span>
              )}
            </CardTitle>
            <Link href="/admin/tareas" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tareas pendientes.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((item) => (
                <TaskItem key={`${item.source}-${item.id}`} item={item} canDelete={false} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Nuevas", value: submitted, color: "text-blue-600", href: "/admin/solicitudes?status=submitted" },
          { label: "En revisión", value: inReview, color: "text-yellow-600", href: "/admin/solicitudes?status=in_review" },
          { label: "En redacción", value: inProgress, color: "text-orange-600", href: "/admin/solicitudes?status=in_progress" },
          { label: "Entregados", value: delivered, color: "text-green-600", href: "/admin/solicitudes?status=delivered" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {requestsWithClientMessages.size > 0 && (
        <Link href="/admin/solicitudes" className="block">
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 transition-colors hover:bg-blue-100">
            <MessageSquare className="h-5 w-5 shrink-0 text-blue-600" />
            <span>
              <strong>{requestsWithClientMessages.size}</strong>{" "}
              {requestsWithClientMessages.size === 1
                ? "solicitud tiene mensajes del cliente"
                : "solicitudes tienen mensajes de clientes"}
              . Haz clic para revisar.
            </span>
          </div>
        </Link>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Proyectos recientes</h2>
        {recent && recent.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Referencia</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Dirección</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/admin/solicitudes/${req.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                        {req.reference_code ?? "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(req.organizations as unknown as { name: string } | null)?.name ?? "-"}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3">{req.property_address ?? "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(req.created_at), "dd/MM/yy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin solicitudes todavía.</p>
        )}
      </div>
    </div>
  );
}

export default async function AdminDashboardPage({ searchParams }: DashboardProps) {
  const me = await requireAdmin();

  if (me.role !== "superadmin") {
    return <OperationalDashboard me={me} />;
  }

  const params = (await searchParams) ?? {};
  const period = resolvePeriod(params.period);
  const admin = createSupabaseAdminClient();

  const [pendingItems, opportunitiesResult, financeResult, timeResult, projectsResult] = await Promise.all([
    loadPendingFor(me.id, true),
    admin
      .from("crm_opportunities")
      .select("id, title, stage, estimated_value, probability, next_action, next_action_due, won_at, lost_at, updated_at")
      .order("updated_at", { ascending: false }),
    admin
      .from("finance_entries")
      .select("*")
      .order("entry_date", { ascending: false }),
    admin
      .from("time_entries")
      .select("id, worker_id, request_id, entry_date, hours, description, hourly_cost_snapshot, created_at, updated_at")
      .order("entry_date", { ascending: false }),
    admin
      .from("certificate_requests")
      .select("id, status, assigned_to, property_address, reference_code, created_at, client_deadline, estimated_delivery_date, delivered_at")
      .not("status", "in", "(draft,cancelled)")
      .order("created_at", { ascending: false }),
  ]);

  const opportunities = (opportunitiesResult.data ?? []) as OpportunityRow[];
  const financeEntries = (financeResult.data ?? []) as FinanceEntry[];
  const timeEntries = (timeResult.data ?? []) as TimeEntry[];
  const projects = (projectsResult.data ?? []) as ProjectRow[];
  const { overdue, today, upcoming } = splitTasks(pendingItems);

  const activeOpportunities = opportunities.filter((o) => !["won", "lost"].includes(o.stage));
  const activeStageCounts = [...ACTIVE_STAGES, "lead", "negotiation"]
    .filter((stage, index, stages) => stages.indexOf(stage) === index)
    .map((stage) => ({
      stage: stage as OpportunityStage,
      label: STAGE_LABEL[stage as OpportunityStage] ?? stage,
      count: activeOpportunities.filter((o) => o.stage === stage).length,
      value: activeOpportunities
        .filter((o) => o.stage === stage)
        .reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0),
    }))
    .filter((row) => row.count > 0);
  const pipelineValue = activeOpportunities.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
  const weightedPipeline = activeOpportunities.reduce(
    (sum, o) => sum + Number(o.estimated_value ?? 0) * (Number(o.probability ?? 0) / 100),
    0,
  );
  const wonInPeriod = opportunities.filter((o) => o.stage === "won" && isDateInRange(o.won_at, period.from, period.to));
  const lostInPeriod = opportunities.filter((o) => o.stage === "lost" && isDateInRange(o.lost_at, period.from, period.to));
  const nextWeekIso = toIsoDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const crmActionsDue = activeOpportunities
    .filter((o) => o.next_action_due && o.next_action_due <= nextWeekIso)
    .slice(0, 5);

  const periodFinanceEntries = filterByDateRange(financeEntries, period.from, period.to);
  const periodTimeEntries = timeEntries.filter((entry) => entry.entry_date >= period.from && entry.entry_date <= period.to);
  const pnl = computePnl(periodFinanceEntries, periodTimeEntries);
  const pendingIncome = financeEntries
    .filter((entry) => entry.kind === "income" && !entry.is_settled)
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const pendingExpense = financeEntries
    .filter((entry) => entry.kind === "expense" && !entry.is_settled)
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

  const activeProjects = projects.filter((p) => !["delivered", "cancelled", "draft"].includes(p.status));
  const warningLimit = toIsoDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const projectsWithDeadline = activeProjects.filter((p) => {
    const deadline = p.client_deadline ?? p.estimated_delivery_date;
    return deadline != null && deadline <= warningLimit;
  });
  const deliveredInPeriod = projects.filter((p) => p.status === "delivered" && isDateInRange(p.delivered_at, period.from, period.to));
  const unassignedProjects = activeProjects.filter((p) => !p.assigned_to);
  const waitingInfoProjects = activeProjects.filter((p) => p.status === "awaiting_info");

  return (
    <div className="space-y-6">
      <TaskNotifier items={pendingItems} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de negocio</h1>
          <p className="text-sm text-muted-foreground">
            Resumen de CRM, contabilidad, proyectos y tareas para {period.label}.
          </p>
        </div>
        <PeriodSelector active={period.period} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">CRM</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Pipeline activo" value={formatCurrency(pipelineValue)} detail={`${activeOpportunities.length} oportunidades abiertas`} href="/admin/crm" tone="blue" />
          <SummaryCard title="Pipeline ponderado" value={formatCurrency(weightedPipeline)} detail="Valor ajustado por probabilidad" href="/admin/crm/funnel" />
          <SummaryCard title="Ganadas en periodo" value={wonInPeriod.length} detail={formatCurrency(wonInPeriod.reduce((s, o) => s + Number(o.estimated_value ?? 0), 0))} href="/admin/crm" tone="green" />
          <SummaryCard title="Perdidas en periodo" value={lostInPeriod.length} detail="Oportunidades cerradas como perdidas" href="/admin/crm" tone="red" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Oportunidades activas por etapa</CardTitle>
            </CardHeader>
            <CardContent>
              {activeStageCounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay oportunidades activas.</p>
              ) : (
                <div className="space-y-3">
                  {activeStageCounts.map((row) => (
                    <div key={row.stage} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-muted-foreground">{row.count} · {formatCurrency(row.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Próximas acciones CRM</CardTitle>
            </CardHeader>
            <CardContent>
              {crmActionsDue.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin acciones vencidas o próximas.</p>
              ) : (
                <div className="space-y-3">
                  {crmActionsDue.map((opp) => (
                    <Link key={opp.id} href={`/admin/crm/oportunidades/${opp.id}`} className="block rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{opp.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {opp.next_action_due ? format(new Date(opp.next_action_due), "dd/MM/yy") : ""}
                        </span>
                      </div>
                      {opp.next_action && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{opp.next_action}</p>}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Contabilidad</h2>
          </div>
          <Link href="/admin/contabilidad/p-y-l" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Ver P&L detallado <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Ingresos" value={formatCurrency(pnl.totals.totalIncome)} detail={`Periodo ${period.from} a ${period.to}`} tone="green" />
          <SummaryCard title="Gastos" value={formatCurrency(pnl.totals.totalVariableCost + pnl.totals.totalFixedCost)} detail="Costes variables + fijos" tone="red" />
          <SummaryCard title="Margen bruto" value={formatCurrency(pnl.totals.grossMargin)} detail={formatPercent(pnl.totals.grossMarginPct)} tone={pnl.totals.grossMargin >= 0 ? "green" : "red"} />
          <SummaryCard title="Margen neto" value={formatCurrency(pnl.totals.netMargin)} detail={formatPercent(pnl.totals.netMarginPct)} tone={pnl.totals.netMargin >= 0 ? "green" : "red"} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryCard title="Pendiente de cobro" value={formatCurrency(pendingIncome)} detail="Ingresos no liquidados" href="/admin/contabilidad" tone="amber" />
          <SummaryCard title="Pendiente de pago" value={formatCurrency(pendingExpense)} detail="Gastos no liquidados" href="/admin/contabilidad" tone="amber" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Proyectos</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard title="Activos" value={activeProjects.length} href="/admin/solicitudes" />
          <SummaryCard title="Sin asignar" value={unassignedProjects.length} href="/admin/solicitudes" tone={unassignedProjects.length > 0 ? "amber" : "default"} />
          <SummaryCard title="Límite próximo/vencido" value={projectsWithDeadline.length} href="/admin/solicitudes" tone={projectsWithDeadline.length > 0 ? "red" : "default"} />
          <SummaryCard title="Pendientes de información" value={waitingInfoProjects.length} href="/admin/solicitudes?status=awaiting_info" tone={waitingInfoProjects.length > 0 ? "amber" : "default"} />
          <SummaryCard title="Entregados en periodo" value={deliveredInPeriod.length} href="/admin/solicitudes?status=delivered" tone="green" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Tareas del superadministrador</h2>
          </div>
          <Link href="/admin/tareas" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                Vencidas ({overdue.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdue.slice(0, 5).map((item) => <TaskItem key={`${item.source}-${item.id}`} item={item} canDelete={false} />)}
              {overdue.length === 0 && <p className="text-sm text-muted-foreground">Sin tareas vencidas.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-amber-600" />
                Hoy ({today.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {today.slice(0, 5).map((item) => <TaskItem key={`${item.source}-${item.id}`} item={item} canDelete={false} />)}
              {today.length === 0 && <p className="text-sm text-muted-foreground">Nada programado para hoy.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-blue-600" />
                Próximas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.slice(0, 5).map((item) => <TaskItem key={`${item.source}-${item.id}`} item={item} canDelete={false} />)}
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Sin próximas tareas.</p>}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
