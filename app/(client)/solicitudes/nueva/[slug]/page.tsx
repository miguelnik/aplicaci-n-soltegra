import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceBySlug } from "@/lib/services";
import { NuevaSolicitudForm } from "../NuevaSolicitudForm";
import type { FormSchema } from "@/lib/form-schema/types";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NuevaSolicitudFormPage({ params }: Props) {
  const profile = await requireClient();
  const { slug } = await params;

  const service = await getServiceBySlug(slug);
  if (!service || !service.is_active) notFound();

  const supabase = await createSupabaseServerClient();

  // Schema actual del formulario para este servicio
  const { data: schemaRow } = await supabase
    .from("form_schemas")
    .select("id, version, schema")
    .eq("service_type_id", service.id)
    .eq("is_current", true)
    .maybeSingle();

  if (!schemaRow) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-muted-foreground">
          Este servicio aún no tiene formulario configurado. Contacta con Soltegra.
        </p>
        <Link href="/solicitudes/nueva" className="mt-4 inline-block text-sm text-primary hover:underline">
          Volver a elegir servicio
        </Link>
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
      service_type_id: service.id,
      form_data: {},
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !request) redirect("/solicitudes");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/solicitudes/nueva"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Cambiar servicio
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Nueva solicitud — {service.name}</h1>
        {service.description && (
          <p className="text-muted-foreground">{service.description}</p>
        )}
      </div>
      <NuevaSolicitudForm
        schema={schemaRow.schema as unknown as FormSchema}
        requestId={request.id}
        organizationId={profile.organization_id!}
      />
    </div>
  );
}
