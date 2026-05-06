import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FormBuilderClient } from "./FormBuilderClient";
import type { FormSchema } from "@/lib/form-schema/types";

export default async function FormularioPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data: current } = await supabase
    .from("form_schemas")
    .select("id, version, schema, is_draft")
    .eq("is_current", true)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Editor de formulario</h1>
        <p className="text-muted-foreground">
          Configura qué información se le pide al cliente al crear una solicitud.
          Cada cambio crea una nueva versión — las solicitudes existentes no se ven afectadas.
        </p>
      </div>
      <FormBuilderClient
        currentSchema={(current?.schema as unknown as FormSchema) ?? { sections: [] }}
        currentVersion={current?.version ?? 0}
      />
    </div>
  );
}
