import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveServices } from "@/lib/services";
import { LoteSolicitudForm } from "./LoteSolicitudForm";

export default async function SolicitudLotePage() {
  const profile = await requireClient();
  const supabase = await createSupabaseServerClient();

  const services = await getActiveServices();

  if (services.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No hay servicios disponibles. Contacta con Soltegra.
      </div>
    );
  }

  // Cargar el schema actual de cada servicio para poder mapear servicio → form_schema_id
  const { data: schemaRows } = await supabase
    .from("form_schemas")
    .select("id, service_type_id")
    .eq("is_current", true);

  const schemaByService = new Map<string, string>();
  (schemaRows ?? []).forEach((r: { id: string; service_type_id: string }) => {
    schemaByService.set(r.service_type_id, r.id);
  });

  // Filtrar solo servicios que tengan schema configurado
  const servicesWithSchema = services
    .filter((s) => schemaByService.has(s.id))
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      schemaId: schemaByService.get(s.id)!,
    }));

  if (servicesWithSchema.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Los servicios disponibles aún no tienen formulario configurado. Contacta con Soltegra.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solicitud en lote</h1>
        <p className="text-muted-foreground">
          Crea varias solicitudes a la vez. Después podrás completar los datos de cada una individualmente.
        </p>
      </div>
      <LoteSolicitudForm
        organizationId={profile.organization_id!}
        profileId={profile.id}
        services={servicesWithSchema}
      />
    </div>
  );
}
