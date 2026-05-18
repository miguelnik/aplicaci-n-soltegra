import { notFound } from "next/navigation";
import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/client/StatusBadge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, AlertTriangle, XCircle } from "lucide-react";
import { DeleteRequestButton } from "./DeleteRequestButton";
import { getRequestMessages } from "@/lib/messages";
import { getEffectiveModules, filterModulesForRole } from "@/lib/modules/defaults";
import { ModuleSwitch } from "@/components/modules/ModuleSwitch";
import type { FormSchema } from "@/lib/form-schema/types";
import type { ServiceModuleConfig, FileWithUrl, ExpeditionDocument, ModulePageData } from "@/lib/modules/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SolicitudDetallePage({ params }: Props) {
  const profile = await requireClient();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // ── 1. Cargar solicitud con joins ────────────────────────────────────────
  const { data: req } = await supabase
    .from("certificate_requests")
    .select(`
      *,
      form_schemas(schema),
      service_types(name, slug, module_config, status_phases)
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id!)
    .single();

  if (!req) notFound();

  // ── 2. Archivos del cliente con URLs firmadas ────────────────────────────
  const { data: rawFiles } = await supabase
    .from("request_files")
    .select("id, field_key, original_filename, mime_type, size_bytes, storage_path")
    .eq("request_id", id)
    .order("uploaded_at");

  const filesWithUrls: FileWithUrl[] = await Promise.all(
    (rawFiles ?? []).map(async (f) => {
      const { data } = await supabase.storage
        .from("request-uploads")
        .createSignedUrl(f.storage_path, 900);
      return { ...f, signedUrl: data?.signedUrl ?? null };
    }),
  );

  // ── 3. Mensajes del hilo ─────────────────────────────────────────────────
  const messages = await getRequestMessages(id);

  // ── 4. Documentos del expediente (expedition_documents) ─────────────────
  // RLS filtra automáticamente a los visibles al cliente de su organización
  const { data: rawExpeditionDocs } = await supabase
    .from("expedition_documents")
    .select("id, request_id, category, label, storage_path, original_filename, mime_type, size_bytes, is_visible_to_client, uploaded_at, internal_notes")
    .eq("request_id", id)
    .order("uploaded_at");

  const expeditionDocuments: ExpeditionDocument[] = await Promise.all(
    (rawExpeditionDocs ?? []).map(async (d) => {
      const { data } = await supabase.storage
        .from("expedition-docs")
        .createSignedUrl(d.storage_path, 900);
      return {
        ...d,
        category: d.category as ExpeditionDocument["category"],
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );

  // ── 4b. Datos de módulos de proyecto / obra (RLS filtra por visibilidad) ─
  const [
    { data: rawMilestones },
    { data: rawDecisions },
    { data: rawModificationMessages },
    { data: rawIncidents },
    { data: rawRisks },
    { data: rawSiteVisits },
    { data: rawMeetingMinutes },
    { data: budget },
    { data: costItems },
    { data: rawPhotos },
    { data: rawAttachments },
  ] = await Promise.all([
    supabase.from("expedition_milestones").select("*").eq("request_id", id).order("order"),
    supabase.from("expedition_decisions").select("*").eq("request_id", id).order("created_at"),
    supabase.from("modification_messages").select("*").eq("request_id", id).order("created_at"),
    supabase.from("expedition_incidents").select("*").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("expedition_risks").select("*").eq("request_id", id).order("created_at"),
    supabase.from("expedition_site_visits").select("*").eq("request_id", id).order("visited_at", { ascending: false }),
    supabase.from("expedition_meeting_minutes").select("*").eq("request_id", id).order("meeting_date", { ascending: false }),
    supabase.from("expedition_budget").select("*").eq("request_id", id).maybeSingle(),
    supabase.from("expedition_cost_items").select("*").eq("request_id", id).order("created_at"),
    supabase.from("expedition_photos").select("*").eq("request_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("expedition_attachments").select("*").eq("request_id", id).order("created_at"),
  ]);

  // Generar signed URLs para fotos y actas con adjuntos
  const photos = await Promise.all(
    (rawPhotos ?? []).map(async (p) => {
      const { data } = await supabase.storage
        .from("expedition-photos")
        .createSignedUrl(p.storage_path, 900);
      return { ...p, signedUrl: data?.signedUrl ?? null };
    }),
  );

  const meetingMinutes = await Promise.all(
    (rawMeetingMinutes ?? []).map(async (m) => {
      if (!m.storage_path) return { ...m, signedUrl: null };
      const { data } = await supabase.storage
        .from("expedition-docs")
        .createSignedUrl(m.storage_path, 900);
      return { ...m, signedUrl: data?.signedUrl ?? null };
    }),
  );

  const attachments = await Promise.all(
    (rawAttachments ?? []).map(async (a) => {
      const { data } = await supabase.storage
        .from("expedition-attachments")
        .createSignedUrl(a.storage_path, 900);
      return { ...a, signedUrl: data?.signedUrl ?? null };
    }),
  );

  const attachmentsFor = (entityType: "decision" | "incident" | "site_visit", entityId: string) =>
    attachments.filter((a) => a.entity_type === entityType && a.entity_id === entityId);

  // ── 5. Configuración de módulos para este tipo de servicio ───────────────
  const serviceType = req.service_types as unknown as {
    slug: string;
    module_config: ServiceModuleConfig | null;
    status_phases: Array<{ key: string; label: string; description?: string }> | null;
  } | null;
  const serviceSlug = serviceType?.slug ?? "";
  const rawModuleConfig = serviceType?.module_config ?? null;
  const statusPhases = serviceType?.status_phases ?? [];

  const allModules = getEffectiveModules(serviceSlug, rawModuleConfig);
  const clientModules = filterModulesForRole(allModules, "client");

  // ── 6. Datos del schema ──────────────────────────────────────────────────
  const schema =
    (req.form_schemas as unknown as { schema: FormSchema } | null)?.schema ?? null;

  // ── 7. Estado derivado ───────────────────────────────────────────────────
  const isDraft = req.status === "draft";
  const isCancelled = req.status === "cancelled";
  const isDeletable = ["draft", "submitted", "cancelled"].includes(req.status);

  // ── 8. Objeto de datos para los módulos ─────────────────────────────────
  const moduleData: ModulePageData = {
    req: {
      id: req.id,
      status: req.status,
      status_history: (req.status_history ?? []) as Array<{ status: string; at: string }>,
      property_address: req.property_address ?? null,
      reference_code: req.reference_code ?? null,
      estimated_delivery_date: req.estimated_delivery_date ?? null,
      delivered_at: req.delivered_at ?? null,
      certificate_pdf_path: req.certificate_pdf_path ?? null,
      form_data: (req.form_data ?? {}) as Record<string, unknown>,
      is_paid: req.is_paid ?? false,
      paid_at: req.paid_at ?? null,
      price: (req.price as number | null) ?? null,
      is_hidden_from_client: (req.is_hidden_from_client as boolean | undefined) ?? false,
      internal_notes: req.internal_notes ?? null,
      client_notes: req.client_notes ?? null,
      client_deadline: req.client_deadline ?? null,
      organization_id: req.organization_id,
      created_at: req.created_at,
      current_phase_key: (req.current_phase_key as string | null) ?? null,
      assigned_to: (req.assigned_to as string | null) ?? null,
    },
    statusPhases,
    schema,
    filesWithUrls,
    messages,
    expeditionDocuments,
    // Módulos de proyecto y obra
    milestones:     (rawMilestones ?? []) as import("@/lib/modules/expedition-types").ExpeditionMilestone[],
    decisions:      (rawDecisions ?? []).map((d) => ({
      ...d,
      attachments: attachmentsFor("decision", d.id),
    })) as import("@/lib/modules/expedition-types").ExpeditionDecision[],
    modificationMessages: (rawModificationMessages ?? []) as import("@/lib/modules/expedition-types").ModificationMessage[],
    incidents:      (rawIncidents ?? []).map((i) => ({
      ...i,
      attachments: attachmentsFor("incident", i.id),
    })) as import("@/lib/modules/expedition-types").ExpeditionIncident[],
    risks:          (rawRisks ?? []) as import("@/lib/modules/expedition-types").ExpeditionRisk[],
    siteVisits:     (rawSiteVisits ?? []).map((v) => ({
      ...v,
      attachments: attachmentsFor("site_visit", v.id),
    })) as import("@/lib/modules/expedition-types").ExpeditionSiteVisit[],
    meetingMinutes: meetingMinutes as import("@/lib/modules/expedition-types").ExpeditionMeetingMinute[],
    photos:         photos as import("@/lib/modules/expedition-types").ExpeditionPhoto[],
    budget:         (budget ?? null) as import("@/lib/modules/expedition-types").ExpeditionBudget | null,
    costItems:      (costItems ?? []) as import("@/lib/modules/expedition-types").ExpeditionCostItem[],
    attachments:    attachments as import("@/lib/modules/expedition-types").ExpeditionAttachment[],
  };

  return (
    <div className="space-y-6">
      {/* ── Cabecera del sistema (siempre visible) ── */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/solicitudes"
            className="flex items-center gap-1 hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Mis proyectos
          </Link>
          <span>/</span>
          <span className="font-mono">{req.reference_code ?? id.slice(0, 8)}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-xl font-bold sm:text-2xl">
            {req.property_address ?? "Sin nombre"}
          </h1>
          <StatusBadge status={req.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {(req.service_types as unknown as { name: string } | null)?.name && (
            <>
              <span className="font-medium">
                {(req.service_types as unknown as { name: string }).name}
              </span>{" "}
              ·{" "}
            </>
          )}
          Expediente creado el{" "}
          {format(new Date(req.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* ── Alerta de fecha límite del cliente (sistema, siempre si existe) ── */}
      {req.client_deadline && !isDraft && !isCancelled && (
        <div className="flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-4 py-2 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Fecha límite solicitada:{" "}
            <strong>
              {format(
                new Date(req.client_deadline),
                "d 'de' MMMM 'de' yyyy",
                { locale: es },
              )}
            </strong>
          </span>
        </div>
      )}

      {/* ── Banner de cancelación (sistema) ── */}
      {isCancelled && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-4">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="font-semibold text-destructive">Solicitud cancelada</p>
            <p className="text-sm text-muted-foreground">
              Esta solicitud ha sido cancelada. Si crees que es un error o
              tienes alguna duda, contacta con el equipo de Soltegra.
            </p>
            <div className="pt-1">
              <DeleteRequestButton requestId={req.id} isDraft={false} />
            </div>
          </div>
        </div>
      )}

      {/* ── Banner de borrador (sistema) ── */}
      {isDraft && (
        <div className="rounded-lg border bg-muted/40 px-4 py-4">
          <p className="mb-2 text-sm text-muted-foreground">
            Esta solicitud está guardada como borrador.{" "}
            <Link
              href="/solicitudes/nueva"
              className="text-primary hover:underline"
            >
              Continuar y enviarla
            </Link>
          </p>
          <DeleteRequestButton requestId={req.id} isDraft />
        </div>
      )}

      {/* ── Sección de módulos configurables ─────────────────────────────── */}
      {/* Cada módulo se renderiza en el orden configurado para este servicio */}
      {clientModules.map((m) => (
        <ModuleSwitch
          key={m.key}
          module={m}
          data={moduleData}
          currentRole="client"
        />
      ))}

      {/* ── Botón de eliminación al pie (sistema, solo para enviadas activas) ── */}
      {isDeletable && !isDraft && !isCancelled && (
        <div className="flex justify-end border-t pt-4">
          <DeleteRequestButton requestId={req.id} isDraft={false} />
        </div>
      )}
    </div>
  );
}
