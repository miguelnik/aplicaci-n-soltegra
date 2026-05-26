import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PipelineBoard } from "./PipelineBoard";
import type { CrmOpportunityWithRelations } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function CrmPipelinePage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: rows } = await admin
    .from("crm_opportunities")
    .select(`
      *,
      contacts:contact_id ( full_name, email ),
      organizations:organization_id ( name ),
      profiles:owner_id ( full_name ),
      service_types:service_type_id ( name )
    `)
    .order("updated_at", { ascending: false });

  const opportunities: CrmOpportunityWithRelations[] = (rows ?? []).map((r) => {
    const contact = r.contacts as { full_name?: string | null; email?: string | null } | null;
    const org     = r.organizations as { name?: string | null } | null;
    const owner   = r.profiles as { full_name?: string | null } | null;
    const svc     = r.service_types as { name?: string | null } | null;
    return {
      id: r.id,
      title: r.title,
      contact_id: r.contact_id,
      organization_id: r.organization_id,
      owner_id: r.owner_id,
      stage: r.stage,
      service_type_id: r.service_type_id,
      estimated_value: r.estimated_value != null ? Number(r.estimated_value) : null,
      expected_close_date: r.expected_close_date,
      probability: r.probability,
      next_action: r.next_action,
      next_action_due: r.next_action_due,
      notes: r.notes,
      lost_reason: r.lost_reason,
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      won_at: r.won_at,
      lost_at: r.lost_at,
      converted_to_request_id: r.converted_to_request_id,
      contact_name: contact?.full_name ?? null,
      contact_email: contact?.email ?? null,
      organization_name: org?.name ?? null,
      owner_name: owner?.full_name ?? null,
      service_name: svc?.name ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Arrastra las tarjetas entre columnas para cambiar el estado.
        </p>
        <Button asChild size="sm">
          <Link href="/admin/crm/oportunidades/nueva">
            <Plus className="h-3.5 w-3.5" />
            Nueva oportunidad
          </Link>
        </Button>
      </div>

      <PipelineBoard opportunities={opportunities} />
    </div>
  );
}
