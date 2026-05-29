import { notFound } from "next/navigation";
import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceBySlug } from "@/lib/services";
import { NuevaSolicitudForm } from "../NuevaSolicitudForm";
import { Card, CardContent } from "@/components/ui/card";
import type { FormSchema } from "@/lib/form-schema/types";
import { ArrowLeft, CheckCircle2, FileUp, Save } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NuevaSolicitudFormPage({ params }: Props) {
  const profile = await requireClient();
  const { slug } = await params;

  const service = await getServiceBySlug(slug);
  if (!service || !service.is_active) notFound();

  const supabase = await createSupabaseServerClient();

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

  // NO creamos el borrador aquí. Se crea en el cliente solo cuando el usuario
  // hace clic en "Guardar borrador" o "Enviar solicitud" (o sube un archivo).
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
          <p className="mt-1 max-w-2xl text-muted-foreground">{service.description}</p>
        )}
        </div>
        <Card>
          <CardContent className="space-y-3 p-4 text-sm">
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4 text-primary" />
              <span>Puedes guardar borrador y continuar más tarde.</span>
            </div>
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-primary" />
              <span>Adjunta archivos cuando el formulario los pida.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Al enviar, Soltegra recibirá el aviso automáticamente.</span>
            </div>
          </CardContent>
        </Card>
      </div>
      <NuevaSolicitudForm
        schema={schemaRow.schema as unknown as FormSchema}
        schemaId={schemaRow.id}
        serviceId={service.id}
        organizationId={profile.organization_id!}
        profileId={profile.id}
      />
    </div>
  );
}
