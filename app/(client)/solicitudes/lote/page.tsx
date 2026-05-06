import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoteSolicitudForm } from "./LoteSolicitudForm";

export default async function SolicitudLotePage() {
  const profile = await requireClient();
  const supabase = await createSupabaseServerClient();

  const { data: schemaRow } = await supabase
    .from("form_schemas")
    .select("id")
    .eq("is_current", true)
    .single();

  if (!schemaRow) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No hay formulario configurado. Contacta con Soltegra.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solicitud en lote</h1>
        <p className="text-muted-foreground">
          Crea varias solicitudes a la vez introduciendo las direcciones. Después podrás completar los datos de cada una individualmente.
        </p>
      </div>
      <LoteSolicitudForm
        organizationId={profile.organization_id!}
        profileId={profile.id}
        formSchemaId={schemaRow.id}
      />
    </div>
  );
}
