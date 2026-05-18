import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NewFinanceEntryClient } from "./NewFinanceEntryClient";

export default async function NuevoMovimientoPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  // Cargar listas pequeñas para los selectores (cliente y proyecto opcionales)
  const [{ data: orgs }, { data: requests }] = await Promise.all([
    admin.from("organizations").select("id, name").order("name"),
    admin
      .from("certificate_requests")
      .select("id, reference_code, property_address, organization_id, service_types(slug)")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  // Aplanar service_types para evitar problemas con tipos
  const reqs = (requests ?? []).map((r) => ({
    id: r.id,
    reference_code: r.reference_code,
    property_address: r.property_address,
    organization_id: r.organization_id,
    service_slug: Array.isArray(r.service_types) ? r.service_types[0]?.slug : (r.service_types as { slug?: string } | null)?.slug ?? null,
  }));

  return (
    <NewFinanceEntryClient
      organizations={orgs ?? []}
      requests={reqs}
    />
  );
}
