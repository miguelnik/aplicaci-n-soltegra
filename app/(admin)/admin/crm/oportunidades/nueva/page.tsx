import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ArrowLeft } from "lucide-react";
import { NewOpportunityClient } from "./NewOpportunityClient";

export const dynamic = "force-dynamic";

export default async function NewOpportunityPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: orgs }, { data: contacts }, { data: services }, { data: workers }] = await Promise.all([
    admin.from("organizations").select("id, name").order("name"),
    admin.from("crm_contacts").select("id, full_name, organization_id, company_name").order("full_name"),
    admin.from("service_types").select("id, name").eq("is_active", true).order("display_order").order("name"),
    admin.from("profiles").select("id, full_name").in("role", ["admin", "superadmin"]).order("full_name"),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/admin/crm/oportunidades" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </Link>
      <h2 className="text-xl font-bold">Nueva oportunidad</h2>

      <NewOpportunityClient
        organizations={orgs ?? []}
        contacts={contacts ?? []}
        services={services ?? []}
        workers={workers ?? []}
      />
    </div>
  );
}
