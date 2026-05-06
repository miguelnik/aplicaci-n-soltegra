import { notFound } from "next/navigation";
import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/client/StatusBadge";
import { FormRenderer } from "@/components/forms/FormRenderer";
import type { FormSchema } from "@/lib/form-schema/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Download, FileText, CheckCircle2, Clock } from "lucide-react";

const STATUS_STEPS = [
  { key: "submitted", label: "Solicitud recibida" },
  { key: "in_review", label: "En revisión" },
  { key: "in_progress", label: "En redacción" },
  { key: "delivered", label: "Entregado" },
] as const;

function StatusTimeline({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Solicitud cancelada
      </div>
    );
  }

  const specialLabel =
    status === "awaiting_info" ? "Pendiente de información adicional de tu parte" : null;

  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  const activeIdx = status === "awaiting_info" ? 2 : currentIdx;

  return (
    <div className="space-y-2">
      {specialLabel && (
        <div className="rounded-md bg-yellow-50 px-4 py-2 text-sm text-yellow-800 border border-yellow-200">
          {specialLabel} — contacta con Soltegra para más información.
        </div>
      )}
      <div className="flex items-center gap-0">
        {STATUS_STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors ${
                    done
                      ? "border-primary bg-primary text-white"
                      : active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 bg-background text-muted-foreground/50"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`mt-1 hidden text-center text-xs sm:block ${
                    done || active ? "text-foreground font-medium" : "text-muted-foreground/50"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 ${done ? "bg-primary" : "bg-muted-foreground/20"}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SolicitudDetallePage({ params }: Props) {
  const profile = await requireClient();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: req } = await supabase
    .from("certificate_requests")
    .select(`*, form_schemas(schema)`)
    .eq("id", id)
    .eq("organization_id", profile.organization_id!)
    .single();

  if (!req) notFound();

  const { data: files } = await supabase
    .from("request_files")
    .select("id, field_key, original_filename, mime_type, size_bytes, storage_path")
    .eq("request_id", id)
    .order("uploaded_at");

  // Generar signed URLs para los archivos subidos
  const filesWithUrls = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await supabase.storage
        .from("request-uploads")
        .createSignedUrl(f.storage_path, 900);
      return { ...f, signedUrl: data?.signedUrl ?? null };
    }),
  );

  const schema = (req.form_schemas as unknown as { schema: FormSchema } | null)?.schema;
  const isDelivered = req.status === "delivered";
  const isDraft = req.status === "draft";

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/solicitudes" className="hover:text-primary flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Mis certificados
          </Link>
          <span>/</span>
          <span className="font-mono">{req.reference_code ?? id.slice(0, 8)}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{req.property_address ?? "Sin dirección"}</h1>
          <StatusBadge status={req.status} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Solicitud creada el {format(new Date(req.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* Progreso */}
      {!isDraft && (
        <Card>
          <CardContent className="pt-6 pb-4">
            <StatusTimeline status={req.status} />
          </CardContent>
        </Card>
      )}

      {/* Fecha prevista + descarga */}
      <div className="flex flex-wrap gap-3">
        {req.estimated_delivery_date && !isDelivered && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-4 py-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              Entrega prevista:{" "}
              <strong>
                {format(new Date(req.estimated_delivery_date), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </strong>
            </span>
          </div>
        )}
        {isDelivered && req.certificate_pdf_path && (
          <Button asChild className="gap-2">
            <Link href={`/solicitudes/${id}/descargar`}>
              <Download className="h-4 w-4" />
              Descargar certificado energético
            </Link>
          </Button>
        )}
      </div>

      {/* Datos del formulario */}
      {schema && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información enviada</CardTitle>
          </CardHeader>
          <CardContent>
            <FormRenderer
              schema={schema}
              defaultValues={req.form_data as import("@/lib/form-schema/types").FormData}
              requestId={req.id}
              organizationId={req.organization_id}
              disabled
            />
          </CardContent>
        </Card>
      )}

      {/* Archivos adjuntos */}
      {filesWithUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Archivos adjuntos ({filesWithUrls.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {filesWithUrls.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.original_filename}</span>
                    {f.size_bytes && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(f.size_bytes / 1024).toFixed(0)} KB
                      </span>
                    )}
                  </div>
                  {f.signedUrl && (
                    <Button variant="ghost" size="sm" asChild className="ml-2 shrink-0">
                      <a href={f.signedUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Ver
                      </a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isDraft && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Esta solicitud está guardada como borrador.{" "}
            <Link href={`/solicitudes/nueva`} className="text-primary hover:underline">
              Continuar y enviarla
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
