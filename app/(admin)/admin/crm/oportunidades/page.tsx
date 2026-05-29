import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, CalendarClock, Euro, Filter, Plus, TrendingUp, UserRound } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  STAGE_LABEL, STAGE_COLOR, ALL_STAGES,
  type OpportunityStage,
} from "@/lib/crm/types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ stage?: string; owner?: string }>;
}

const money = (value: number) => value.toLocaleString("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default async function OportunidadesPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  const stageFilter = (sp.stage && ALL_STAGES.includes(sp.stage as OpportunityStage))
    ? sp.stage as OpportunityStage
    : null;

  // Cargar lista de owners para el filtro
  const { data: owners } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("role", ["admin", "superadmin"])
    .order("full_name");

  let q = admin
    .from("crm_opportunities")
    .select(`
      *,
      contacts:contact_id ( full_name ),
      organizations:organization_id ( name ),
      profiles:owner_id ( full_name ),
      service_types:service_type_id ( name )
    `)
    .order("updated_at", { ascending: false });
  if (stageFilter) q = q.eq("stage", stageFilter);
  if (sp.owner) q = q.eq("owner_id", sp.owner);

  const { data: rows } = await q;
  const opps = rows ?? [];
  const totalValue = opps.reduce((sum, opp) => sum + Number(opp.estimated_value ?? 0), 0);
  const weightedValue = opps.reduce((sum, opp) => {
    const probability = Number(opp.probability ?? 0);
    return sum + (Number(opp.estimated_value ?? 0) * probability) / 100;
  }, 0);
  const openOpps = opps.filter((opp) => !["won", "lost"].includes(String(opp.stage))).length;
  const oppsWithNextAction = opps.filter((opp) => Boolean(opp.next_action)).length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">Pipeline comercial</p>
            <h1 className="text-2xl font-bold tracking-tight">Oportunidades</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Revisa valor, estado y siguiente acción de las oportunidades abiertas.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/crm/oportunidades/nueva">
              <Plus className="h-4 w-4" />
              Nueva oportunidad
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Oportunidades visibles</p>
            <BriefcaseBusiness className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{opps.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{openOpps} abiertas</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Valor estimado</p>
            <Euro className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{money(totalValue)}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Valor ponderado</p>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{money(weightedValue)}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Con siguiente acción</p>
            <CalendarClock className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{oppsWithNextAction}</p>
        </div>
      </div>

      <form className="rounded-lg border bg-background p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Estado</label>
              <select
                name="stage"
                defaultValue={stageFilter ?? ""}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                {ALL_STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Comercial</label>
              <select
                name="owner"
                defaultValue={sp.owner ?? ""}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                {(owners ?? []).map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name ?? o.id.slice(0,8)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 lg:flex-none">
              <Filter className="h-4 w-4" />
              Aplicar
            </Button>
            {(stageFilter || sp.owner) && (
              <Button variant="outline" asChild>
                <Link href="/admin/crm/oportunidades">Limpiar</Link>
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Tabla */}
      {opps.length === 0 ? (
        <div className="rounded-lg border bg-background px-4 py-10 text-center shadow-sm">
          <p className="font-medium">Sin oportunidades con esos filtros.</p>
          <p className="mt-1 text-sm text-muted-foreground">Cambia los filtros o crea una oportunidad nueva.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="hidden overflow-x-auto rounded-lg border bg-background shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Título</th>
                  <th className="px-3 py-2 text-left font-medium">Cliente</th>
                  <th className="px-3 py-2 text-left font-medium">Servicio</th>
                  <th className="px-3 py-2 text-left font-medium">Estado</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 text-left font-medium">Cierre est.</th>
                  <th className="px-3 py-2 text-left font-medium">Comercial</th>
                  <th className="px-3 py-2 text-left font-medium">Próxima acción</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {opps.map((o) => {
                  const contact = o.contacts as { full_name?: string | null } | null;
                  const org     = o.organizations as { name?: string | null } | null;
                  const owner   = o.profiles as { full_name?: string | null } | null;
                  const svc     = o.service_types as { name?: string | null } | null;
                  const stage = o.stage as OpportunityStage;
                  return (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Link href={`/admin/crm/oportunidades/${o.id}`} className="font-medium text-primary hover:underline">
                          {o.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {org?.name ?? contact?.full_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{svc?.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={STAGE_COLOR[stage]}>
                          {STAGE_LABEL[stage]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {o.estimated_value != null ? money(Number(o.estimated_value)) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {o.expected_close_date ? format(parseISO(o.expected_close_date), "d MMM yyyy", { locale: es }) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{owner?.full_name ?? "—"}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-xs text-muted-foreground">
                        {o.next_action ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {opps.map((o) => {
              const contact = o.contacts as { full_name?: string | null } | null;
              const org = o.organizations as { name?: string | null } | null;
              const owner = o.profiles as { full_name?: string | null } | null;
              const svc = o.service_types as { name?: string | null } | null;
              const stage = o.stage as OpportunityStage;
              return (
                <Link
                  key={o.id}
                  href={`/admin/crm/oportunidades/${o.id}`}
                  className="rounded-lg border bg-background p-4 shadow-sm transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold">{o.title}</p>
                      <p className="text-sm text-muted-foreground">{org?.name ?? contact?.full_name ?? "Sin cliente"}</p>
                    </div>
                    <Badge variant="outline" className={STAGE_COLOR[stage]}>
                      {STAGE_LABEL[stage]}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>{svc?.name ?? "Sin servicio"}</span>
                      <span className="font-mono font-semibold text-foreground">
                        {o.estimated_value != null ? money(Number(o.estimated_value)) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                      <span>{o.expected_close_date ? format(parseISO(o.expected_close_date), "d MMM yyyy", { locale: es }) : "Sin cierre estimado"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />
                      <span>{owner?.full_name ?? "Sin comercial"}</span>
                    </div>
                  </div>
                  {o.next_action && (
                    <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                      {o.next_action}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
