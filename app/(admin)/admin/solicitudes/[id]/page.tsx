import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import { StatusChanger } from "./StatusChanger";
import { PdfUploader } from "./PdfUploader";
import { FormRenderer } from "@/components/forms/FormRenderer";
import type { FormSchema } from "@/lib/form-schema/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentToggle } from "@/components/admin/PaymentToggle";
import { ClientNotesEditor } from "@/components/admin/ClientNotesEditor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminSolicitudDetallePage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: req } = await supabase
    .from("certificate_requests")
    .select(`
      *,
      organizations(name, contact_email),
      profiles(full_name),
      form_schemas(schema),
      service_types(name, slug)
    `)
    .eq("id", id)
    .single();

  if (!req) notFound();

  const { data: files } = await supabase
    .from("request_files")
    .select("id, field_key, original_filename, mime_type, size_bytes, storage_path, uploaded_at")
    .eq("request_id", id)
    .order("uploaded_at");

  const schema = (req.form_schemas as unknown as { schema: FormSchema })?.schema;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + título */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/solicitudes" className="hover:text-primary">Solicitudes</Link>
          <span>/</span>
          <span className="font-mono">{req.reference_code ?? id.slice(0, 8)}</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{req.property_address ?? "Sin dirección"}</h1>
          <StatusBadge status={req.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {(req.organizations as unknown as { name: string } | null)?.name}
          {(req.service_types as unknown as { name: string } | null)?.name && (
            <> · <span className="font-medium">{(req.service_types as unknown as { name: string }).name}</span></>
          )}
          {" "}· Creada el {format(new Date(req.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* Fecha límite del cliente */}
      {req.client_deadline && (
        <div className="flex items-center gap-3 rounded-lg border-2 border-red-400 bg-red-50 px-5 py-3 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">
              Fecha límite del cliente:{" "}
              {format(new Date(req.client_deadline), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
            <p className="text-xs text-red-600">El cliente necesita el certificado antes de esta fecha</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna izquierda: datos del formulario + archivos */}
        <div className="space-y-6 lg:col-span-2">
          {schema && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos enviados por el cliente</CardTitle>
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

          {files && files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Archivos adjuntos ({files.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {files.map((f) => (
                    <DownloadFileRow key={f.id} file={f} requestId={id} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Columna derecha: acciones admin */}
        <div className="space-y-4">
          <StatusChanger requestId={req.id} currentStatus={req.status} />
          {req.status !== "draft" && req.status !== "cancelled" && (
            <PaymentToggle
              requestId={req.id}
              isPaid={req.is_paid}
              paidAt={req.paid_at}
            />
          )}
          <ClientNotesEditor
            requestId={req.id}
            initialNotes={req.client_notes ?? null}
          />
          <PdfUploader
            requestId={req.id}
            organizationId={req.organization_id}
            currentPdfPath={req.certificate_pdf_path}
          />
          {req.internal_notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notas internas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{req.internal_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DownloadFileRow({
  file,
  requestId,
}: {
  file: { id: string; original_filename: string; size_bytes: number | null; mime_type: string | null; storage_path: string };
  requestId: string;
}) {
  return (
    <li className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{file.original_filename}</span>
      <div className="ml-2 flex items-center gap-2 shrink-0">
        {file.size_bytes && (
          <span className="text-xs text-muted-foreground">
            {(file.size_bytes / 1024).toFixed(0)} KB
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
          <Link href={`/admin/solicitudes/${requestId}/archivo/${file.id}`}>
            <Download className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </li>
  );
}
