import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { BudgetDetailClient } from "./BudgetDetailClient";
import { BUDGET_STATUS_LABEL, BUDGET_STATUS_COLOR, type BudgetStatus } from "@/lib/budgets/types";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function BudgetDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: budget } = await admin.from("budgets").select(`
    *,
    organizations:organization_id ( id, name ),
    contacts:contact_id ( id, full_name ),
    profiles:owner_id ( full_name ),
    crm_opportunities:opportunity_id ( id, title ),
    certificate_requests:converted_to_request_id ( id, reference_code )
  `).eq("id", id).single();
  if (!budget) notFound();

  const { data: items } = await admin.from("budget_items").select("*").eq("budget_id", id).order("position");

  const [{ data: orgs }, { data: contacts }, { data: services }, { data: workers }, { data: opportunities }] = await Promise.all([
    admin.from("organizations").select("id, name").order("name"),
    admin.from("crm_contacts").select("id, full_name, organization_id, company_name").order("full_name"),
    admin.from("service_types").select("id, name").eq("is_active", true).order("display_order").order("name"),
    admin.from("profiles").select("id, full_name").in("role", ["admin", "superadmin"]).order("full_name"),
    admin.from("crm_opportunities").select("id, title").order("updated_at", { ascending: false }).limit(200),
  ]);

  const stage = budget.status as BudgetStatus;
  const org = budget.organizations as { id: string; name: string } | null;
  const opp = budget.crm_opportunities as { id: string; title: string } | null;
  const req = budget.certificate_requests as { id: string; reference_code: string | null } | null;

  return (
    <div className="space-y-4">
      <Link href="/admin/presupuestos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">
            {budget.title}
          </h2>
          <Badge variant="outline" className={BUDGET_STATUS_COLOR[stage]}>
            {BUDGET_STATUS_LABEL[stage]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{budget.number ?? "—"}</span>
          <Button asChild size="sm">
            <a href={`/api/admin/budgets/${id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
              Ver / descargar PDF
            </a>
          </Button>
        </div>
      </div>

      {/* Cabecera con datos clave */}
      <Card>
        <CardContent className="grid gap-3 pt-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Cliente</p>
            <p className="font-medium">{budget.client_legal_name ?? "—"}</p>
            {budget.client_cif && <p className="text-xs text-muted-foreground">CIF: {budget.client_cif}</p>}
            {org && <Link href={`/admin/clientes/${org.id}`} className="text-xs text-primary hover:underline">Ver cliente →</Link>}
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Fecha emisión</p>
            <p>{budget.issue_date ? format(parseISO(budget.issue_date), "d MMM yyyy", { locale: es }) : "—"}</p>
            {budget.valid_until && (
              <>
                <p className="mt-1 text-[11px] uppercase text-muted-foreground">Válido hasta</p>
                <p>{format(parseISO(budget.valid_until), "d MMM yyyy", { locale: es })}</p>
              </>
            )}
          </div>
          <div>
            {opp && (
              <>
                <p className="text-[11px] uppercase text-muted-foreground">Oportunidad</p>
                <Link href={`/admin/crm/oportunidades/${opp.id}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  {opp.title} <ExternalLink className="h-3 w-3" />
                </Link>
              </>
            )}
            {req && (
              <>
                <p className="mt-2 text-[11px] uppercase text-muted-foreground">Proyecto generado</p>
                <Link href={`/admin/solicitudes/${req.id}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  {req.reference_code ?? "Ver proyecto"} <ExternalLink className="h-3 w-3" />
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editor de partidas + cabecera + estado + datos cliente */}
      <BudgetDetailClient
        budget={{
          id: budget.id,
          number: budget.number,
          title: budget.title,
          intro: budget.intro,
          vat_pct: Number(budget.vat_pct),
          issue_date: budget.issue_date,
          valid_until: budget.valid_until,
          status: stage,
          rejection_reason: budget.rejection_reason,
          contact_id: budget.contact_id,
          organization_id: budget.organization_id,
          opportunity_id: budget.opportunity_id,
          owner_id: budget.owner_id,
          converted_to_request_id: budget.converted_to_request_id,
          client_legal_name: budget.client_legal_name,
          client_cif: budget.client_cif,
          client_address: budget.client_address,
          client_email: budget.client_email,
          client_phone: budget.client_phone,
          payment_terms: budget.payment_terms,
          legal_notes: budget.legal_notes,
        }}
        initialItems={(items ?? []).map((it) => ({
          id: it.id,
          concept: it.concept,
          description: it.description,
          quantity: Number(it.quantity),
          unit: it.unit,
          unit_price: Number(it.unit_price),
          discount_pct: Number(it.discount_pct),
        }))}
        organizations={orgs ?? []}
        contacts={contacts ?? []}
        services={services ?? []}
        workers={workers ?? []}
        opportunities={opportunities ?? []}
      />
    </div>
  );
}
