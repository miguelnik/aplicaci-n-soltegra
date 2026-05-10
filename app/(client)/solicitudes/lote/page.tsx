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

  // Cargar el schema actual de cada servicio
  const { data: schemaRows } = await supabase
    .from("form_schemas")
    .select("id, service_type_id, schema")
    .eq("is_current", true);

  type SchemaRow = { id: string; service_type_id: string; schema: { titleFieldKey?: string; sections?: { fields?: { key: string; label: string; type: string }[] }[] } };

  const schemaByService = new Map<string, { id: string; titleFieldKey: string | null; titleFieldLabel: string | null }>();
  (schemaRows ?? []).forEach((r: SchemaRow) => {
    const titleKey = r.schema?.titleFieldKey ?? null;
    let titleLabel: string | null = null;
    if (titleKey) {
      for (const section of r.schema?.sections ?? []) {
        const f = section.fields?.find((field) => field.key === titleKey);
        if (f) {
          titleLabel = f.label;
          break;
        }
      }
    }
    schemaByService.set(r.service_type_id, {
      id: r.id,
      titleFieldKey: titleKey,
      titleFieldLabel: titleLabel,
    });
  });

  // Solo permitimos lote para servicios con schema configurado Y campo título definido
  const servicesWithSchema = services
    .filter((s) => {
      const meta = schemaByService.get(s.id);
      return meta && meta.titleFieldKey;
    })
    .map((s) => {
      const meta = schemaByService.get(s.id)!;
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        schemaId: meta.id,
        titleFieldKey: meta.titleFieldKey!,
        titleFieldLabel: meta.titleFieldLabel ?? "Valor",
      };
    });

  if (servicesWithSchema.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-muted-foreground">
          Ningún servicio disponible permite crear solicitudes en lote.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          (El admin debe configurar un campo título en el formulario del servicio para habilitarlo).
        </p>
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
