import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
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
import { EditableProjectName } from "./EditableProjectName";
import { ProjectTasksPanel } from "./ProjectTasksPanel";
import type { FinanceEntry } from "@/lib/finance/types";
import type { TimeEntryWithWorker } from "@/lib/hours/types";
import { batchSignedUrls } from "@/lib/storage/signed-urls";

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
  searchParams?: Promise<{ tab?: string }>;
}

const PROJECT_TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "cliente", label: "Cliente y datos" },
  { key: "documentos", label: "Documentos" },
  { key: "conversacion", label: "Conversación" },
  { key: "tareas", label: "Tareas" },
  { key: "horas", label: "Horas" },
  { key: "finanzas", label: "Finanzas" },
  { key: "ajustes", label: "Ajustes" },
] as const;

type ProjectTab = (typeof PROJECT_TABS)[number]["key"];

function isProjectTab(value: string | undefined): value is ProjectTab {
  return PROJECT_TABS.some((tab) => tab.key === value);
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function ProjectTabs({
  requestId,
  activeTab,
}: {
  requestId: string;
  activeTab: ProjectTab;
}) {
  return (
    <div className="overflow-x-auto border-b">
      <nav className="flex min-w-max gap-1" aria-label="Secciones del proyecto">
        {PROJECT_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/admin/solicitudes/${requestId}?tab=${tab.key}`}
              className={[
                "rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-border border-b-background bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function ProjectSummaryTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-base font-semibold">{value}</div>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export default async function AdminSolicitudDetallePage({ params, searchParams }: Props) {
  const me = await requireAdmin();
  const isSuper = me.role === "superadmin";
  const { id } = await params;
  const rawSearchParams = (await searchParams) ?? {};
  const activeTab: ProjectTab = isProjectTab(rawSearchParams.tab)
    ? rawSearchParams.tab
    : "resumen";
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

  // Cargamos files + expedition docs en paralelo (filtros con índice por request_id)
  const [filesRes, docsRes] = await Promise.all([
    admin
      .from("request_files")
      .select("id, field_key, original_filename, mime_type, size_bytes, storage_path, uploaded_at")
      .eq("request_id", id)
      .order("uploaded_at"),
    admin
      .from("expedition_documents")
      .select("id, request_id, category, label, storage_path, original_filename, mime_type, size_bytes, is_visible_to_client, uploaded_at, internal_notes")
      .eq("request_id", id)
      .order("uploaded_at"),
  ]);
  const files = filesRes.data;
  const rawExpeditionDocs = docsRes.data;

  // Las signed URLs sólo hacen falta cuando la pestaña activa muestra los documentos
  const needsDocsUrls = ["resumen", "cliente", "documentos"].includes(activeTab);
  const docsSignedMap = needsDocsUrls
    ? await batchSignedUrls(admin, "expedition-docs", (rawExpeditionDocs ?? []).map((d) => d.storage_path))
    : {};
  const expeditionDocs = (rawExpeditionDocs ?? []).map((d) => ({
    ...d,
    signedUrl: docsSignedMap[d.storage_path] ?? null,
  }));

  // Trabajadores disponibles para asignación (admins + superadmins)
  const { data: workers } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "superadmin"])
    .order("full_name");

  const schema = (req.form_schemas as unknown as { schema: FormSchema })?.schema;
  // Mensajes sólo se usan en resumen y conversacion — evitamos cargarlos en el resto
  const needsMessages = activeTab === "resumen" || activeTab === "conversacion";
  const messages = needsMessages ? await getRequestMessages(id) : [];
  const serviceType = req.service_types as unknown as {
    name: string;
    slug: string;
    status_phases: Array<{ key: string; label: string; description?: string }>;
  } | null;
  const statusPhases = serviceType?.status_phases ?? [];
  const serviceSlug  = serviceType?.slug ?? null;

  // Finanzas y horas — sólo en pestañas que los muestran (o resumen que los resume).
  const needsFinance = activeTab === "finanzas" || activeTab === "resumen";
  const needsHours = activeTab === "horas" || activeTab === "finanzas" || activeTab === "resumen";

  const { data: financeRows } = needsFinance
    ? await admin
        .from("finance_entries")
        .select("*")
        .eq("request_id", id)
        .order("entry_date", { ascending: false })
    : { data: [] };
  const financeEntries = (financeRows ?? []) as FinanceEntry[];

  // ── Horas imputadas + datos para rentabilidad real ─────────────────────
  const [
    { data: timeRows },
    { data: overheadHoursRows },
    { data: activeIds },
  ] = needsHours
    ? await Promise.all([
        // Horas del propio proyecto
        admin.from("time_entries")
          .select("*, profiles:worker_id(full_name)")
          .eq("request_id", id)
          .order("entry_date", { ascending: false }),
        // Horas de overhead (sin proyecto asignado)
        admin.from("time_entries")
          .select("hours, hourly_cost_snapshot")
          .is("request_id", null),
        // Proyectos activos (status no en draft/cancelled/delivered)
        admin.from("certificate_requests")
          .select("id")
          .not("status", "in", "(draft,cancelled,delivered)"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }] as [
        { data: never[] },
        { data: never[] },
        { data: never[] },
      ];

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
  const activeCount = (activeIds ?? []).length;
  if (activeCount > 0) {
    const totalOverheadCost = (overheadHoursRows ?? []).reduce(
      (a, e) => a + Number(e.hours) * Number(e.hourly_cost_snapshot ?? 0),
      0,
    );
    indirectLaborCost = totalOverheadCost / activeCount;
  }

  // Tareas vinculadas al proyecto
  const { data: projectTaskRows } = await admin
    .from("user_tasks")
    .select("*, assignee:assignee_id(full_name), creator:created_by(full_name)")
    .eq("request_id", id)
    .order("status", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false });
  const projectTasks = (projectTaskRows ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    due_at: t.due_at,
    priority: t.priority,
    status: t.status,
    assignee_id: t.assignee_id,
    contact_id: t.contact_id,
    request_id: t.request_id,
    assignee_name: (t.assignee as { full_name?: string | null } | null)?.full_name ?? null,
    creator_name: (t.creator as { full_name?: string | null } | null)?.full_name ?? null,
  }));

  // Lista de workers (admin/superadmin) para el formulario de horas
  // (sólo necesaria si el actual es superadmin, pero la cargamos siempre por simplicidad)
  const workersList = (workers ?? []).map((w) => ({
    id: w.id,
    full_name: w.full_name,
    hourly_cost: null,
  }));
  const assignedWorkerName =
    workersList.find((worker) => worker.id === req.assigned_to)?.full_name ?? "Sin asignar";
  const currentPhaseLabel =
    statusPhases.find((phase) => phase.key === req.current_phase_key)?.label ?? "Sin fase";
  const clientName = (req.organizations as unknown as { name: string } | null)?.name ?? "Cliente sin nombre";
  const serviceName = (req.service_types as unknown as { name: string } | null)?.name ?? null;
  const openProjectTasks = projectTasks.filter((task) => task.status !== "done");
  const recentProjectTasks = projectTasks.slice(0, 5);
  const recentMessages = messages.slice(-3).reverse();
  const visibleExpeditionDocs = expeditionDocs.filter((doc) => doc.is_visible_to_client).length;
  const deadline = req.client_deadline ?? req.estimated_delivery_date ?? null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + título */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/solicitudes" className="hover:text-primary">
            Proyectos
          </Link>
          <span>/</span>
          <span className="font-mono">{req.reference_code ?? id.slice(0, 8)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <EditableProjectName requestId={req.id} initialName={req.property_address ?? ""} />
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
          Proyecto
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

      <ProjectTabs requestId={id} activeTab={activeTab} />

      {activeTab === "resumen" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ProjectSummaryTile label="Estado" value={<StatusBadge status={req.status} />} />
            <ProjectSummaryTile label="Fase" value={currentPhaseLabel} />
            <ProjectSummaryTile label="Asignado" value={assignedWorkerName} />
            <ProjectSummaryTile
              label="Precio y pago"
              value={formatMoney((req.price as number | null) ?? null)}
              detail={req.is_paid ? "Pagado" : "Pendiente de pago"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ProjectSummaryTile
              label="Fecha límite"
              value={deadline ? format(new Date(deadline), "dd/MM/yyyy") : "Sin fecha"}
              detail={req.client_deadline ? "Compromiso indicado por el cliente" : undefined}
            />
            <ProjectSummaryTile label="Tareas abiertas" value={openProjectTasks.length} detail={`${projectTasks.length} tareas totales`} />
            <ProjectSummaryTile label="Comunicaciones" value={messages.length} detail="Mensajes con el cliente" />
            <ProjectSummaryTile
              label="Documentos"
              value={expeditionDocs.length}
              detail={`${visibleExpeditionDocs} visibles para cliente · ${files?.length ?? 0} iniciales`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Últimas tareas</CardTitle>
              </CardHeader>
              <CardContent>
                {recentProjectTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay tareas vinculadas a este proyecto.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentProjectTasks.map((task) => (
                      <li key={task.id} className="rounded-md border px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{task.title}</span>
                          <Badge variant={task.status === "done" ? "secondary" : "outline"}>{task.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.assignee_name ?? "Sin asignar"}
                          {task.due_at ? ` · ${format(new Date(task.due_at), "dd/MM/yyyy")}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={`/admin/solicitudes/${id}?tab=tareas`} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  Gestionar tareas
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Últimas comunicaciones</CardTitle>
              </CardHeader>
              <CardContent>
                {recentMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no hay mensajes con el cliente.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentMessages.map((message) => (
                      <li key={message.id} className="rounded-md border px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {message.authorRole === "admin" ? "Soltegra" : message.authorName ?? "Cliente"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.createdAt), "dd/MM/yyyy HH:mm")}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-muted-foreground">{message.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={`/admin/solicitudes/${id}?tab=conversacion`} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  Abrir conversación
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "cliente" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ProjectSummaryTile label="Cliente" value={clientName} />
            <ProjectSummaryTile
              label="Email"
              value={(req.organizations as unknown as { contact_email: string | null } | null)?.contact_email ?? "—"}
            />
            <ProjectSummaryTile label="Servicio" value={serviceName ?? "—"} />
          </div>

          {schema ? (
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
          ) : (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground">Este proyecto no tiene formulario inicial asociado.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Archivos del formulario ({files?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {files && files.length > 0 ? (
                <ul className="space-y-2">
                  {files.map((f) => (
                    <DownloadFileRow key={f.id} file={f} requestId={id} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No hay archivos iniciales del cliente.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "documentos" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-4 w-4" />
                Documentos del expediente
                {expeditionDocs.length > 0 && (
                  <span className="ml-1 font-normal text-muted-foreground">({expeditionDocs.length})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expeditionDocs.length > 0 ? (
                <ul className="space-y-2">
                  {expeditionDocs.map((doc) => {
                    const catInfo = CATEGORY_LABELS[doc.category] ?? {
                      label: doc.category,
                      variant: "outline" as const,
                    };
                    const deleteBound = deleteExpeditionDoc.bind(null, doc.id, doc.storage_path, id);
                    return (
                      <li key={doc.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
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
                              {doc.size_bytes != null && ` · ${(doc.size_bytes / 1024).toFixed(0)} KB`}
                            </p>
                          </div>
                          <Badge variant={catInfo.variant} className="shrink-0 text-[10px]">
                            {catInfo.label}
                          </Badge>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {doc.signedUrl && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" title="Descargar">
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
                <p className="text-sm text-muted-foreground">Sin documentos de expediente todavía.</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subir nuevo documento</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpeditionDocUploader requestId={req.id} organizationId={req.organization_id} />
              </CardContent>
            </Card>
            <PdfUploader
              requestId={req.id}
              organizationId={req.organization_id}
              currentPdfPath={req.certificate_pdf_path}
            />
          </div>
        </div>
      )}

      {activeTab === "conversacion" && (
        <MessageThread
          requestId={req.id}
          messages={messages}
          currentRole="admin"
          title="Conversación con el cliente"
          placeholder="Escribe un mensaje para el cliente..."
        />
      )}

      {activeTab === "tareas" && (
        <ProjectTasksPanel
          requestId={req.id}
          currentUserId={me.id}
          workers={workersList}
          tasks={projectTasks}
        />
      )}

      {activeTab === "horas" && (
        <HoursPanel
          requestId={req.id}
          entries={timeEntries}
          currentUserId={me.id}
          currentRole={isSuper ? "superadmin" : "admin"}
          workers={workersList}
        />
      )}

      {activeTab === "finanzas" && (
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
      )}

      {activeTab === "ajustes" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <AssignWorker
            requestId={req.id}
            currentAssignedTo={req.assigned_to ?? null}
            workers={workers ?? []}
          />
          <ErpPanel
            requestId={req.id}
            initialPrice={(req.price as number | null) ?? null}
            initialHidden={(req.is_hidden_from_client as boolean | undefined) ?? false}
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
            <PaymentToggle requestId={req.id} isPaid={req.is_paid} paidAt={req.paid_at} />
          )}
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
          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-destructive">Zona de peligro</CardTitle>
            </CardHeader>
            <CardContent>
              <DeleteAdminRequestButton requestId={req.id} referenceCode={req.reference_code ?? null} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
