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
import { ArrowLeft, Download, FileText, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";
import { DeleteRequestButton } from "./DeleteRequestButton";
import { MessageThread } from "@/components/messages/MessageThread";
import { getRequestMessages } from "@/lib/messages";

const STATUS_STEPS = [
  { key: "submitted", label: "Solicitud recibida", shortLabel: "Recibida" },
  { key: "in_review", label: "En revisión", shortLabel: "Revisión" },
  { key: "in_progress", label: "En redacción", shortLabel: "Redacción" },
  { key: "delivered", label: "Entregado", shortLabel: "Entregado" },
] as const;

type HistoryEntry = { status: string; at: string };

function StatusTimeline({
  status,
  history,
}: {
  status: string;
  history: HistoryEntry[];
}) {
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

  const historyMap = new Map<string, string>();
  for (const entry of history) {
    if (!historyMap.has(entry.status)) {
      historyMap.set(entry.status, entry.at);
    }
  }

  return (
    <div className="space-y-3">
      {specialLabel && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          {specialLabel} — contacta con Soltegra para más información.
        </div>
      )}
      <div className="flex items-start gap-0">
        {STATUS_STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          const dateStr = historyMap.get(step.key);

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
                  className={`mt-1 text-center text-xs leading-tight ${
                    done || active ? "font-medium text-foreground" : "text-muted-foreground/50"
                  }`}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </span>
                {dateStr && (done || active) && (
                  <span className="mt-0.5 text-center text-[10px] text-muted-foreground">
                    {format(new Date(dateStr), "d MMM", { locale: es })}
                  </span>
                )}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div
                  className={`mx-1 mt-4 h-0.5 flex-1 ${done ? "bg-primary" : "bg-muted-foreground/20"}`}
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
    .select(`*, form_schemas(schema), service_types(name, slug)`)
    .eq("id", id)
    .eq("organization_id", profile.organization_id!)
    .single();

  if (!req) notFound();

  const { data: files } = await supabase
    .from("request_files")
    .select("id, field_key, original_filename, mime_type, size_bytes, storage_path")
    .eq("request_id", id)
    .order("uploaded_at");

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
  const isCancelled = req.status === "cancelled";
  // El cliente puede borrar: borradores, enviadas y canceladas
  const isDeletable = ["draft", "submitted", "cancelled"].includes(req.status);
  const statusHistory = (req.status_history ?? []) as HistoryEntry[];
  const messages = await getRequestMessages(id);
  // El cliente solo puede escribir mensajes en solicitudes activas (no draft ni cancelled)
  const canWriteMessages = req.status !== "draft" && req.status !== "cancelled";

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/solicitudes" className="flex items-center gap-1 hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" />
            Mis solicitudes
          </Link>
          <span>/</span>
          <span className="font-mono">{req.reference_code ?? id.slice(0, 8)}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-xl font-bold sm:text-2xl">{req.property_address ?? "Sin dirección"}</h1>
          <StatusBadge status={req.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {(req.service_types as unknown as { name: string } | null)?.name && (
            <><span className="font-medium">{(req.service_types as unknown as { name: string }).name}</span> · </>
          )}
          Solicitud creada el {format(new Date(req.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* Banner de cancelación */}
      {isCancelled && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-4">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="font-semibold text-destructive">Solicitud cancelada</p>
            <p className="text-sm text-muted-foreground">
              Esta solicitud ha sido cancelada. Si crees que es un error o tienes alguna duda,
              contacta con el equipo de Soltegra.
            </p>
            <div className="pt-1">
              <DeleteRequestButton requestId={req.id} isDraft={false} />
            </div>
          </div>
        </div>
      )}

      {/* Conversación con el equipo Soltegra */}
      {!isDraft && (
        <MessageThread
          requestId={req.id}
          messages={messages}
          currentRole="client"
          title="Conversación con Soltegra"
          placeholder="Escribe un mensaje para el equipo..."
          disabled={!canWriteMessages}
        />
      )}

      {/* Timeline — oculto para canceladas (ya hay banner) y borradores */}
      {!isDraft && !isCancelled && (
        <Card>
          <CardContent className="pb-4 pt-6">
            <StatusTimeline status={req.status} history={statusHistory} />
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
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.original_filename}</span>
                    {f.size_bytes && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {(f.size_bytes / 1024).toFixed(0)} KB
                      </span>
                    )}
                  </div>
                  {f.signedUrl && (
                    <Button variant="ghost" size="sm" asChild className="ml-2 shrink-0">
                      <a href={f.signedUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-1 h-3.5 w-3.5" />
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

      {/* Fecha límite del cliente */}
      {req.client_deadline && (
        <div className="flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-4 py-2 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4" />
          <span>
            Fecha límite solicitada:{" "}
            <strong>{format(new Date(req.client_deadline), "d 'de' MMMM 'de' yyyy", { locale: es })}</strong>
          </span>
        </div>
      )}

      {/* Borrador: continuar o eliminar */}
      {isDraft && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
            <p>
              Esta solicitud está guardada como borrador.{" "}
              <Link href="/solicitudes/nueva" className="text-primary hover:underline">
                Continuar y enviarla
              </Link>
            </p>
            <DeleteRequestButton requestId={req.id} isDraft />
          </CardContent>
        </Card>
      )}

      {/* Solicitud enviada (no cancelada, no entregada): opción de eliminar */}
      {isDeletable && !isDraft && !isCancelled && (
        <div className="flex justify-end border-t pt-4">
          <DeleteRequestButton requestId={req.id} isDraft={false} />
        </div>
      )}
    </div>
  );
}
