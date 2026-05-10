import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceById } from "@/lib/services";
import { FormBuilderClient } from "../../../formulario/FormBuilderClient";
import type { FormSchema } from "@/lib/form-schema/types";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function ServicioFormularioPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;

  const service = await getServiceById(id);
  if (!service) notFound();

  const supabase = await createSupabaseServerClient();

  const { data: current } = await supabase
    .from("form_schemas")
    .select("id, version, schema, is_draft")
    .eq("service_type_id", id)
    .eq("is_current", true)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/servicios/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al servicio
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Formulario — {service.name}</h1>
        <p className="text-sm text-muted-foreground">
          Configura qué información se le pide al cliente cuando solicita este servicio.
          Cada cambio crea una nueva versión — las solicitudes existentes no se ven afectadas.
        </p>
      </div>

      {created && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          Servicio creado. Ahora añade los campos del formulario y publícalo.
        </div>
      )}

      <FormBuilderClient
        currentSchema={(current?.schema as unknown as FormSchema) ?? { sections: [] }}
        currentVersion={current?.version ?? 0}
        serviceTypeId={id}
      />
    </div>
  );
}
