import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LibraryClient } from "./LibraryClient";

export const dynamic = "force-dynamic";

export default async function ConceptLibraryPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: concepts }, { data: services }] = await Promise.all([
    admin.from("budget_concept_library")
      .select("*, service_types:service_type_id(name)")
      .order("concept"),
    admin.from("service_types").select("id, name").eq("is_active", true).order("display_order").order("name"),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conceptos / partidas reutilizables individuales. A diferencia de las plantillas, aquí guardas líneas sueltas (ej. &ldquo;Visita técnica · 85€&rdquo;) que después puedes añadir una a una a cualquier presupuesto.
      </p>
      <LibraryClient
        initial={(concepts ?? []).map((c) => ({
          id: c.id,
          concept: c.concept,
          description: c.description,
          unit: c.unit,
          unit_price: Number(c.unit_price),
          default_quantity: Number(c.default_quantity ?? 1),
          service_type_id: c.service_type_id,
          is_active: c.is_active,
          service_name: (c.service_types as { name?: string | null } | null)?.name ?? null,
        }))}
        services={services ?? []}
      />
    </div>
  );
}
