import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import { StatusChanger } from "./StatusChanger";
import { PdfUploader } from "./PdfUploader";
import { FormRenderer } from "@/components/forms/FormRenderer";
import type { FormSchema } from "@/lib/form-schema/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Download,
  AlertTriangle,
  FileText,
  FolderOpen,
  Lock,
  Eye,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentToggle } from "@/components/admin/PaymentToggle";
import { AssignWorker } from "@/components/admin/AssignWorker";
import { MessageThread } from "@/components/messages/MessageThread";
import { getRequestMessages } from "@/lib/messages";
import { ExpeditionDocUploader } from "./ExpeditionDocUploader";
import { PhaseChanger } from "./PhaseChanger";
import { DeleteAdminRequestButton } from "./DeleteAdminRequestButton";
import { ErpPanel } from "./ErpPanel";
import { ProjectFinancePanel } from "./ProjectFinancePanel";
import { HoursPanel } from "./HoursPanel";
import type { FinanceEntry } from "@/lib/finance/types";
import type { TimeEntryWithWorker } from "@/lib/hours/types";

// ──────────────────────────────────────────────────────────────────────────────
// Server Actions
// ──────────────────────────────────────────────────────────────────────────────

async function deleteExpeditionDoc(docId: string, storagePath: string, requestId: string) {
  "use server";
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  // Eliminar de storage
  await admin.storage.from("expedition-docs").remove([storagePath]);

  // Eliminar de BD
  await admin.from("expedition_documents").delete().eq("id", docId);

  redirect(`/admin/solicitudes/${requestId}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ──────────────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  deliverable:    { label: "Entregable",  variant: "default" },
  client_document: { label: "Del cliente", variant: "secondary" },
  admin_document:  { label: "Interno",     variant: "outline" },
};

function DownloadFileRow({
  file,
  requestId,
}: {
  file: {
    id: string;
    original_filename: string;
    size_bytes: number | null;
    mime_type: string | null;
    storage_path: string;
  };
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

// ──────────────────────────────────────────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminSolicitudDetallePage({ params }: Props) {
  const me = await requireAdmin();
  const isSuper = me.role === "superadmin";
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Usar admin client (service_role) para bypasear RLS en páginas de admin.
  // Nota: usamos alias explícito para las FKs a profiles para evitar ambigüedad
  // (certificate_requests tiene created_by y assigned_to, ambas → profiles).
  const { data: req } = await admin
    .from("certificate_requests")
    .select(`
      *,
      organizations(name, contact_email),
      creator:created_by(full_name),
      form_schemas(schema),
      service_types(name, slug, status_phases)
    `)
    .eq("id", id)
    .single();

  if (!req) notFound();

  // Archivos del formulario inicial (request_files)
  const { data: files } = await admin
    .from("request_files")
    .select("id, field_key, original_filename, mime_type, size_bytes, storage_path, uploaded_at")
    .eq("request_id", id)
    .order("uploaded_at");

  // Documentos del expediente (expedition_documents) — admin ve todos
  const { data: rawExpeditionDocs } = await admin
    .from("expedition_documents")
    .select("id, request_id, category, label, storage_path, original_filename, mime_type, size_bytes, is_visible_to_client, uploaded_at, internal_notes")
    .eq("request_id", id)
    .order("uploaded_at");

  // Generar signed URLs para expedition_documents
  const expeditionDocs = await Promise.all(
    (rawExpeditionDocs ?? []).map(async (d) => {
      const { data } = await admin.storage
        .from("expedition-docs")
        .createSignedUrl(d.storage_path, 900);
      return { ...d, signedUrl: data?.signedUrl ?? null };
    }),
  );

  // Trabajadores disponibles para asignación (admins + superadmins)
  const { data: workers } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "superadmin"])
    .order("full_name");

  const schema = (req.form_schemas as unknown as { schema: FormSchema })?.schema;
  const messages = await getRequestMessages(id);
  const serviceType = req.service_types as unknown as {
    name: string;
    slug: string;
    status_phases: Array<{ key: string; label: string; description?: string }>;
  } | null;
  const statusPhases = serviceType?.status_phases ?? [];
  const serviceSlug  = serviceType?.slug ?? null;

  // Apuntes contables del proyecto
  const { data: financeRows } = await admin
    .from("finance_entries")
    .select("*")
    .eq("request_id", id)
    .order("entry_date", { ascending: false });
  const financeEntries = (financeRows ?? []) as FinanceEntry[];

  // ── Horas imputadas + datos para rentabilidad real ─────────────────────
  const [
    { data: timeRows },
    { data: overheadIds },
    { data: activeIds },
  ] = await Promise.all([
    admin.from("time_entries")
      .select("*, profiles:worker_id(full_name)")
      .eq("request_id", id)
      .order("entry_date", { ascending: false }),
    // Proyectos overhead (para sumar sus horas)
    admin.from("certificate_requests")
      .select("id")
      .eq("is_general_overhead", true),
    // Proyectos activos (status no en draft/cancelled/delivered, no overhead)
    admin.from("certificate_requests")
      .select("id")
      .eq("is_general_overhead", false)
      .not("status", "in", "(draft,cancelled,delivered)"),
  ]);

  const timeEntries: TimeEntryWithWorker[] = (timeRows ?? []).map((t) => {
    const prof = (t as { profiles?: { full_name?: string | null } | null }).profiles;
    return {
      id: t.id,
      worker_id: t.worker_id,
      request_id: t.request_id,
      entry_date: t.entry_date,
      hours: Number(t.hours),
      description: t.description,
      hourly_cost_snapshot: t.hourly_cost_snapshot != null ? Number(t.hourly_cost_snapshot) : null,
      created_at: t.created_at,
      updated_at: t.updated_at,
      worker_name: prof?.full_name ?? null,
    };
  });

  // Coste directo de mano de obra de este proyecto
  const directLaborCost = timeEntries.reduce(
    (a, e) => a + Number(e.hours) * Number(e.hourly_cost_snapshot ?? 0),
    0,
  );

  // Coste indirecto prorrateado: suma de coste de horas overhead / nº proyectos activos
  let indirectLaborCost = 0;
  const overheadRequestIds = (overheadIds ?? []).map((r) => r.id);
  const activeCount = (activeIds ?? []).length;
  if (overheadRequestIds.length > 0 && activeCount > 0) {
    const { data: overheadHours } = await admin
      .from("time_entries")
      .select("hours, hourly_cost_snapshot")
      .in("request_id", overheadRequestIds);
    const totalOverheadCost = (overheadHours ?? []).reduce(
      (a, e) => a + Number(e.hours) * Number(e.hourly_cost_snapshot ?? 0),
      0,
    );
    indirectLaborCost = totalOverheadCost / activeCount;
  }

  // Lista de workers (admin/superadmin) para el formulario de horas
  // (sólo necesaria si el actual es superadmin, pero la cargamos siempre por simplicidad)
  const workersList = (workers ?? []).map((w) => ({
    id: w.id,
    full_name: w.full_name,
    hourly_cost: null,
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb + título */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/solicitudes" className="hover:text-primary">
            Solicitudes
          </Link>
          <span>/</span>
          <span className="font-mono">{req.reference_code ?? id.slice(0, 8)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{req.property_address ?? "Sin dirección"}</h1>
          <StatusBadge status={req.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {(req.organizations as unknown as { name: string } | null)?.name}
          {(req.service_types as unknown as { name: string } | null)?.name && (
            <>
              {" "}·{" "}
              <span className="font-medium">
                {(req.service_types as unknown as { name: string }).name}
              </span>
            </>
          )}
          {" "}· Creada el{" "}
          {format(new Date(req.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* Navegación de secciones */}
      <div className="flex gap-1 border-b">
        <span
          className="rounded-t-md border border-b-0 border-border bg-background px-4 py-2 text-sm font-medium"
        >
          Solicitud
        </span>
        <Link
          href={`/admin/solicitudes/${id}/expediente`}
          className="rounded-t-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Expediente
        </Link>
      </div>

      {/* Fecha límite del cliente */}
      {req.client_deadline && (
        <div className="flex items-center gap-3 rounded-lg border-2 border-red-400 bg-red-50 px-5 py-3 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">
              Fecha límite del cliente:{" "}
              {format(
                new Date(req.client_deadline),
                "d 'de' MMMM 'de' yyyy",
                { locale: es },
              )}
            </p>
            <p className="text-xs text-red-600">
              El cliente necesita el certificado antes de esta fecha
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Columna izquierda: datos + archivos + docs expediente ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Formulario inicial */}
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

          {/* Archivos del formulario inicial (request_files) */}
          {files && files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Archivos del formulario ({files.length})
                </CardTitle>
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

          {/* Documentos del expediente (expedition_documents) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-4 w-4" />
                Documentos del expediente
                {expeditionDocs.length > 0 && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({expeditionDocs.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lista de docs existentes */}
              {expeditionDocs.length > 0 ? (
                <ul className="space-y-2">
                  {expeditionDocs.map((doc) => {
                    const catInfo = CATEGORY_LABELS[doc.category] ?? {
                      label: doc.category,
                      variant: "outline" as const,
                    };
                    const deleteBound = deleteExpeditionDoc.bind(
                      null,
                      doc.id,
                      doc.storage_path,
                      id,
                    );
                    return (
                      <li
                        key={doc.id}
                        className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium">{doc.label}</span>
                              {!doc.is_visible_to_client && (
                                <span title="No visible al cliente">
                                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                                </span>
                              )}
                              {doc.is_visible_to_client && (
                                <span title="Visible al cliente">
                                  <Eye className="h-3 w-3 shrink-0 text-green-500" />
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {doc.original_filename}
                              {doc.size_bytes != null &&
                                ` · ${(doc.size_bytes / 1024).toFixed(0)} KB`}
                            </p>
                          </div>
                          <Badge variant={catInfo.variant} className="shrink-0 text-[10px]">
                            {catInfo.label}
                          </Badge>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {doc.signedUrl && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a
                                href={doc.signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Descargar"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          <form action={deleteBound}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              type="submit"
                              title="Eliminar documento"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin documentos de expediente todavía.
                </p>
              )}

              {/* Uploader */}
              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Subir nuevo documento
                </p>
                <ExpeditionDocUploader
                  requestId={req.id}
                  organizationId={req.organization_id}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Columna derecha: acciones admin ── */}
        <div className="space-y-4">
          <AssignWorker
            requestId={req.id}
            currentAssignedTo={req.assigned_to ?? null}
            workers={workers ?? []}
          />
          <ErpPanel
            requestId={req.id}
            initialPrice={(req.price as number | null) ?? null}
            initialHidden={(req.is_hidden_from_client as boolean | undefined) ?? false}
            initialOverhead={(req.is_general_overhead as boolean | undefined) ?? false}
          />
          {statusPhases.length > 0 ? (
            <PhaseChanger
              requestId={req.id}
              currentPhaseKey={req.current_phase_key ?? null}
              phases={statusPhases}
            />
          ) : (
            <StatusChanger
              requestId={req.id}
              currentStatus={req.status}
              currentDeliveryDate={req.estimated_delivery_date}
              currentInternalNotes={req.internal_notes}
            />
          )}
          {req.status !== "draft" && req.status !== "cancelled" && (
            <PaymentToggle
              requestId={req.id}
              isPaid={req.is_paid}
              paidAt={req.paid_at}
            />
          )}
          <MessageThread
            requestId={req.id}
            messages={messages}
            currentRole="admin"
            title="Conversación con el cliente"
            placeholder="Escribe un mensaje para el cliente..."
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

          {/* Zona de peligro */}
          <div className="border-t pt-2">
            <DeleteAdminRequestButton
              requestId={req.id}
              referenceCode={req.reference_code ?? null}
            />
          </div>
        </div>
      </div>

      {/* ── Horas imputadas (ancho completo) ── */}
      <HoursPanel
        requestId={req.id}
        entries={timeEntries}
        currentUserId={me.id}
        currentRole={isSuper ? "superadmin" : "admin"}
        workers={workersList}
      />

      {/* ── Contabilidad del proyecto (ancho completo) ── */}
      <ProjectFinancePanel
        requestId={req.id}
        organizationId={req.organization_id}
        serviceSlug={serviceSlug}
        price={(req.price as number | null) ?? null}
        isPaid={req.is_paid ?? false}
        entries={financeEntries}
        directLaborCost={directLaborCost}
        indirectLaborCost={indirectLaborCost}
        showProfitability={isSuper}
      />
    </div>
  );
}
