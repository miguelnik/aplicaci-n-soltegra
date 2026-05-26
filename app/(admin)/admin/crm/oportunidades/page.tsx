import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Euro } from "lucide-react";
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

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0,
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

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Estado</label>
          <select
            name="stage"
            defaultValue={stageFilter ?? ""}
            className="h-8 w-44 rounded-md border border-input bg-background px-2 text-sm"
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
            className="h-8 w-56 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Todos</option>
            {(owners ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.full_name ?? o.id.slice(0,8)}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90">
          Aplicar
        </button>
        <Link href="/admin/crm/oportunidades" className="text-xs text-muted-foreground hover:text-foreground">
          Limpiar
        </Link>
        <div className="ml-auto">
          <Button asChild size="sm">
            <Link href="/admin/crm/oportunidades/nueva">
              <Plus className="h-3.5 w-3.5" />
              Nueva oportunidad
            </Link>
          </Button>
        </div>
      </form>

      {/* Tabla */}
      {opps.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin oportunidades con esos filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
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
                      {o.estimated_value != null ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Euro className="h-3 w-3 text-muted-foreground" />
                          {Number(o.estimated_value).toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                        </span>
                      ) : "—"}
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
      )}
    </div>
  );
}
