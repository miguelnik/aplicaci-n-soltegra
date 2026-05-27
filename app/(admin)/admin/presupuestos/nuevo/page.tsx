import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ArrowLeft } from "lucide-react";
import { NewBudgetClient } from "./NewBudgetClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ opportunity?: string; contact?: string; org?: string }>;
}

export default async function NewBudgetPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  const [
    { data: orgs },
    { data: contacts },
    { data: templates },
    { data: templateItems },
    { data: library },
    { data: workers },
    { data: opportunities },
    { data: company },
  ] = await Promise.all([
    admin.from("organizations").select("id, name").order("name"),
    admin.from("crm_contacts").select("id, full_name, organization_id, company_name").order("full_name"),
    admin.from("budget_templates").select("id, name, service_type_id, is_active").eq("is_active", true).order("name"),
    admin.from("budget_template_items").select("*").order("position"),
    admin.from("budget_concept_library").select("*, service_types:service_type_id(name)").eq("is_active", true).order("concept"),
    admin.from("profiles").select("id, full_name").in("role", ["admin", "superadmin"]).order("full_name"),
    admin.from("crm_opportunities").select("id, title, contact_id, organization_id, estimated_value").not("stage", "in", "(won,lost)").order("updated_at", { ascending: false }),
    admin.from("company_settings").select("default_vat, payment_terms, legal_notes").maybeSingle(),
  ]);

  // Pre-fill desde query string
  const prefillOpportunity = sp.opportunity ?? "";
  let prefillContact = sp.contact ?? "";
  let prefillOrg = sp.org ?? "";
  let prefillTitle = "";

  if (prefillOpportunity) {
    const opp = (opportunities ?? []).find((o) => o.id === prefillOpportunity);
    if (opp) {
      prefillContact = prefillContact || (opp.contact_id ?? "");
      prefillOrg = prefillOrg || (opp.organization_id ?? "");
      prefillTitle = opp.title;
    }
  }

  // Agrupar items por template para pasar al cliente
  const templatesWithItems = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    service_type_id: t.service_type_id,
    items: (templateItems ?? [])
      .filter((it) => it.template_id === t.id)
      .map((it) => ({
        concept: it.concept,
        description: it.description,
        quantity: Number(it.quantity),
        unit: it.unit,
        unit_price: Number(it.unit_price),
        discount_pct: Number(it.discount_pct),
      })),
  }));

  const libraryList = (library ?? []).map((c) => ({
    id: c.id,
    concept: c.concept,
    description: c.description,
    unit: c.unit,
    unit_price: Number(c.unit_price),
    default_quantity: Number(c.default_quantity ?? 1),
    service_name: (c.service_types as { name?: string | null } | null)?.name ?? null,
  }));

  return (
    <div className="space-y-4">
      <Link href="/admin/presupuestos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </Link>
      <h2 className="text-xl font-bold">Nuevo presupuesto</h2>

      <NewBudgetClient
        organizations={orgs ?? []}
        contacts={contacts ?? []}
        templates={templatesWithItems}
        library={libraryList}
        workers={workers ?? []}
        opportunities={opportunities ?? []}
        defaultVat={company?.default_vat != null ? Number(company.default_vat) : 21}
        prefill={{
          opportunityId: prefillOpportunity,
          contactId: prefillContact,
          organizationId: prefillOrg,
          title: prefillTitle,
        }}
      />
    </div>
  );
}
