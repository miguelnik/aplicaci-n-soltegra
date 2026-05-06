import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NuevaSolicitudForm } from "./NuevaSolicitudForm";
import type { FormSchema } from "@/lib/form-schema/types";

export default async function NuevaSolicitudPage() {
  const profile = await requireClient();
  const supabase = await createSupabaseServerClient();

  // Schema actual del formulario
  const { data: schemaRow } = await supabase
    .from("form_schemas")
    .select("id, version, schema")
    .eq("is_current", true)
    .single();

  if (!schemaRow) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No hay formulario configurado. Contacta con Soltegra.
      </div>
    );
  }

  // Crear el borrador inmediatamente para tener el ID y poder subir archivos
  const { data: request, error } = await supabase
    .from("certificate_requests")
    .insert({
      organization_id: profile.organization_id!,
      created_by: profile.id,
      form_schema_id: schemaRow.id,
      form_data: {},
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !request) redirect("/solicitudes");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nueva solicitud</h1>
        <p className="text-muted-foreground">
          Rellena los datos de la vivienda y sube la documentación necesaria.
        </p>
      </div>
      <NuevaSolicitudForm
        schema={schemaRow.schema as unknown as FormSchema}
        requestId={request.id}
        organizationId={profile.organization_id!}
      />
    </div>
  );
}
