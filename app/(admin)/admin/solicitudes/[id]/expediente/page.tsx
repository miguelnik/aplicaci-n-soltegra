import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import { PhotoUploader } from "./PhotoUploader";
import { EntityAttachments } from "@/components/modules/EntityAttachments";
import { ModificationsModule } from "@/components/modules/ModificationsModule";
import type { ModulePageData } from "@/lib/modules/types";
import {
  saveMilestone,
  completeMilestone,
  deleteMilestone,
  saveIncident,
  deleteIncident,
  saveRisk,
  deleteRisk,
  saveSiteVisit,
  deleteSiteVisit,
  saveMeetingMinute,
  deleteMeetingMinute,
  saveBudget,
  saveCostItem,
  deleteCostItem,
  deletePhoto,
  updatePhotoVisibility,
} from "./actions";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de las pestanas
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "milestones",      label: "Hitos" },
  { key: "decisions",       label: "Modificaciones" },
  { key: "incidents",       label: "Incidencias" },
  { key: "risks",           label: "Riesgos" },
  { key: "site_visits",     label: "Visitas" },
  { key: "meeting_minutes", label: "Actas" },
  { key: "economic",        label: "Económico" },
  { key: "photos",          label: "Fotos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formulario
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function VisibleCheck({ defaultChecked = true }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name="is_visible_to_client"
        value="1"
        defaultChecked={defaultChecked}
        className="h-4 w-4"
      />
      Visible al cliente
    </label>
  );
}

function Select({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ExpedientePage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id: requestId } = await params;
  const { tab: rawTab } = await searchParams;
  const activeTab: TabKey =
    TABS.find((t) => t.key === rawTab)?.key ?? "milestones";

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Solicitud base — usar admin client para bypasear RLS
  const { data: req } = await admin
    .from("certificate_requests")
    .select("id, reference_code, property_address, organization_id")
    .eq("id", requestId)
    .single();

  if (!req) notFound();

  // ── Fetch de datos según pestaña activa ──────────────────────────────────
  const [
    { data: milestones },
    { data: decisions },
    { data: modificationMessages },
    { data: incidents },
    { data: risks },
    { data: siteVisits },
    { data: meetingMinutes },
    { data: budget },
    { data: costItems },
    { data: rawPhotos },
    { data: rawAttachments },
  ] = await Promise.all([
    admin.from("expedition_milestones").select("*").eq("request_id", requestId).order("order"),
    admin.from("expedition_decisions").select("*").eq("request_id", requestId).order("created_at"),
    admin.from("modification_messages").select("*").eq("request_id", requestId).order("created_at"),
    admin.from("expedition_incidents").select("*").eq("request_id", requestId).order("created_at", { ascending: false }),
    admin.from("expedition_risks").select("*").eq("request_id", requestId).order("created_at"),
    admin.from("expedition_site_visits").select("*").eq("request_id", requestId).order("visited_at", { ascending: false }),
    admin.from("expedition_meeting_minutes").select("*").eq("request_id", requestId).order("meeting_date", { ascending: false }),
    admin.from("expedition_budget").select("*").eq("request_id", requestId).maybeSingle(),
    admin.from("expedition_cost_items").select("*").eq("request_id", requestId).order("created_at"),
    admin.from("expedition_photos").select("*").eq("request_id", requestId).order("uploaded_at", { ascending: false }),
    admin.from("expedition_attachments").select("*").eq("request_id", requestId).order("created_at"),
  ]);

  // Fotos con signed URLs
  const photos = await Promise.all(
    (rawPhotos ?? []).map(async (p) => {
      const { data } = await admin.storage
        .from("expedition-photos")
        .createSignedUrl(p.storage_path, 900);
      return { ...p, signedUrl: data?.signedUrl ?? null };
    }),
  );

  const attachments = await Promise.all(
    (rawAttachments ?? []).map(async (a) => {
      const { data } = await admin.storage
        .from("expedition-attachments")
        .createSignedUrl(a.storage_path, 900);
      return { ...a, signedUrl: data?.signedUrl ?? null };
    }),
  );

  const attachmentsFor = (
    entityType: "decision" | "incident" | "site_visit",
    entityId: string,
  ) => attachments.filter((a) => a.entity_type === entityType && a.entity_id === entityId);

  // ── Binders para Server Actions ──────────────────────────────────────────
  const saveMilestoneA   = saveMilestone.bind(null, requestId);
  const saveIncidentA    = saveIncident.bind(null, requestId);
  const saveRiskA        = saveRisk.bind(null, requestId);
  const saveSiteVisitA   = saveSiteVisit.bind(null, requestId);
  const saveMinuteA      = saveMeetingMinute.bind(null, requestId);
  const saveBudgetA      = saveBudget.bind(null, requestId);
  const saveCostItemA    = saveCostItem.bind(null, requestId);

  function tabHref(key: string) {
    return `/admin/solicitudes/${requestId}/expediente?tab=${key}`;
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/solicitudes" className="hover:text-primary">
            Solicitudes
          </Link>
          <span>/</span>
          <span className="font-mono">{req.reference_code ?? requestId.slice(0, 8)}</span>
        </div>
        <h1 className="text-2xl font-bold">
          {req.property_address ?? "Sin dirección"}
        </h1>
      </div>

      {/* Navegación de secciones — igual que en la página de solicitud */}
      <div className="flex gap-1 border-b">
        <Link
          href={`/admin/solicitudes/${requestId}`}
          className="rounded-t-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Solicitud
        </Link>
        <span className="rounded-t-md border border-b-0 border-border bg-background px-4 py-2 text-sm font-medium">
          Expediente
        </span>
      </div>

      {/* Sub-pestanas del expediente */}
      <div className="flex flex-wrap gap-1 border-b pb-0">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "border border-b-0 border-border bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── HITOS ─────────────────────────────────────────────────────────── */}
      {activeTab === "milestones" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Hitos del proyecto</h2>

          {/* Lista */}
          <div className="space-y-2">
            {(milestones ?? []).map((m) => {
              const del  = deleteMilestone.bind(null, requestId, m.id);
              const comp = completeMilestone.bind(null, requestId, m.id);
              return (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.status} · orden {m.order}
                      {m.due_date && ` · ${format(parseISO(m.due_date), "d MMM yyyy", { locale: es })}`}
                      {!m.is_visible_to_client && " · oculto al cliente"}
                    </p>
                  </div>
                  {m.status !== "completed" && (
                    <form action={comp}>
                      <Button variant="outline" size="sm" type="submit" title="Marcar completado">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  )}
                  <form action={del}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" type="submit">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              );
            })}
            {(milestones ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin hitos todavía.</p>
            )}
          </div>

          {/* Formulario nuevo */}
          <form action={saveMilestoneA} className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo hito
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Título" required>
                <Input name="title" required placeholder="Nombre del hito" />
              </Field>
              <Field label="Fecha prevista">
                <Input name="due_date" type="date" />
              </Field>
              <Field label="Estado">
                <Select name="status" defaultValue="pending" options={[
                  { value: "pending",     label: "Pendiente" },
                  { value: "in_progress", label: "En progreso" },
                  { value: "completed",   label: "Completado" },
                  { value: "delayed",     label: "Con retraso" },
                ]} />
              </Field>
              <Field label="Orden">
                <Input name="order" type="number" defaultValue={String((milestones ?? []).length)} min="0" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descripción">
                  <Textarea name="description" rows={2} placeholder="Descripción opcional..." />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <VisibleCheck />
              </div>
            </div>
            <Button type="submit" size="sm">Guardar hito</Button>
          </form>
        </div>
      )}

      {/* ── MODIFICACIONES ───────────────────────────────────────────────── */}
      {activeTab === "decisions" && (
        <ModificationsModule
          module={{ key: "pending_decisions", label: "Modificaciones", is_active: true, visible_to: "both", order: 0 }}
          data={{
            req: { id: requestId } as ModulePageData["req"],
            decisions: (decisions ?? []).map((d) => ({
              ...d,
              attachments: attachmentsFor("decision", d.id),
            })) as ModulePageData["decisions"],
            modificationMessages: (modificationMessages ?? []) as ModulePageData["modificationMessages"],
            photos: photos as ModulePageData["photos"],
          } as ModulePageData}
          currentRole="admin"
        />
      )}

      {/* ── INCIDENCIAS ───────────────────────────────────────────────────── */}
      {activeTab === "incidents" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Registro de incidencias</h2>

          <div className="space-y-2">
            {(incidents ?? []).map((inc) => {
              const del = deleteIncident.bind(null, requestId, inc.id);
              const severityColorMap: Record<string, "secondary" | "outline" | "default" | "destructive"> = { low: "secondary", medium: "outline", high: "default", critical: "destructive" };
              const severityColor = severityColorMap[inc.severity] ?? "outline";
              return (
                <div key={inc.id} className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{inc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {inc.status}
                      {!inc.is_visible_to_client && " · oculta al cliente"}
                      {" · "}{format(parseISO(inc.created_at), "d MMM yyyy", { locale: es })}
                    </p>
                    {inc.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{inc.description}</p>
                    )}
                    <EntityAttachments
                      requestId={requestId}
                      entityType="incident"
                      entityId={inc.id}
                      attachments={attachmentsFor("incident", inc.id)}
                      canUpload
                      compact
                    />
                  </div>
                  <Badge variant={severityColor}>{inc.severity}</Badge>
                  <form action={del}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" type="submit">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              );
            })}
            {(incidents ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin incidencias registradas.</p>
            )}
          </div>

          <form action={saveIncidentA} className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Nueva incidencia
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Título" required>
                <Input name="title" required placeholder="Describe la incidencia" />
              </Field>
              <Field label="Gravedad">
                <Select name="severity" defaultValue="medium" options={[
                  { value: "low",      label: "Baja" },
                  { value: "medium",   label: "Media" },
                  { value: "high",     label: "Alta" },
                  { value: "critical", label: "Critica" },
                ]} />
              </Field>
              <Field label="Estado">
                <Select name="status" defaultValue="open" options={[
                  { value: "open",        label: "Abierta" },
                  { value: "in_progress", label: "En gestion" },
                  { value: "resolved",    label: "Resuelta" },
                  { value: "closed",      label: "Cerrada" },
                ]} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descripción">
                  <Textarea name="description" rows={2} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <VisibleCheck defaultChecked={false} />
              </div>
            </div>
            <Button type="submit" size="sm">Guardar incidencia</Button>
          </form>
        </div>
      )}

      {/* ── RIESGOS ───────────────────────────────────────────────────────── */}
      {activeTab === "risks" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Mapa de riesgos</h2>

          <div className="space-y-2">
            {(risks ?? []).map((r) => {
              const del = deleteRisk.bind(null, requestId, r.id);
              return (
                <div key={r.id} className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      P: {r.probability} · I: {r.impact} · {r.status}
                      {!r.is_visible_to_client && " · oculto al cliente"}
                    </p>
                    {r.mitigation && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Mitigacion: {r.mitigation}
                      </p>
                    )}
                  </div>
                  <form action={del}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" type="submit">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              );
            })}
            {(risks ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin riesgos identificados.</p>
            )}
          </div>

          <form action={saveRiskA} className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo riesgo
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Título" required>
                <Input name="title" required />
              </Field>
              <Field label="Probabilidad">
                <Select name="probability" defaultValue="medium" options={[
                  { value: "low", label: "Baja" },
                  { value: "medium", label: "Media" },
                  { value: "high", label: "Alta" },
                ]} />
              </Field>
              <Field label="Impacto">
                <Select name="impact" defaultValue="medium" options={[
                  { value: "low", label: "Bajo" },
                  { value: "medium", label: "Medio" },
                  { value: "high", label: "Alto" },
                ]} />
              </Field>
              <Field label="Estado">
                <Select name="status" defaultValue="identified" options={[
                  { value: "identified", label: "Identificado" },
                  { value: "mitigated",  label: "Mitigado" },
                  { value: "accepted",   label: "Aceptado" },
                  { value: "closed",     label: "Cerrado" },
                ]} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Descripción">
                  <Textarea name="description" rows={2} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Plan de mitigacion">
                  <Textarea name="mitigation" rows={2} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <VisibleCheck defaultChecked={false} />
              </div>
            </div>
            <Button type="submit" size="sm">Guardar riesgo</Button>
          </form>
        </div>
      )}

      {/* ── VISITAS ───────────────────────────────────────────────────────── */}
      {activeTab === "site_visits" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Visitas de obra</h2>

          <div className="space-y-2">
            {(siteVisits ?? []).map((v) => {
              const del = deleteSiteVisit.bind(null, requestId, v.id);
              return (
                <div key={v.id} className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {format(parseISO(v.visited_at), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {v.technician}
                      {!v.is_visible_to_client && " · oculta al cliente"}
                    </p>
                    {v.observations && (
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                        {v.observations}
                      </p>
                    )}
                    <EntityAttachments
                      requestId={requestId}
                      entityType="site_visit"
                      entityId={v.id}
                      attachments={attachmentsFor("site_visit", v.id)}
                      canUpload
                      compact
                    />
                  </div>
                  <form action={del}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" type="submit">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              );
            })}
            {(siteVisits ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin visitas registradas.</p>
            )}
          </div>

          <form action={saveSiteVisitA} className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Nueva visita
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de la visita" required>
                <Input name="visited_at" type="date" required />
              </Field>
              <Field label="Tecnico / responsable" required>
                <Input name="technician" required placeholder="Nombre del tecnico" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Observaciones">
                  <Textarea name="observations" rows={3} placeholder="Descripcion de lo observado en la visita..." />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <VisibleCheck />
              </div>
            </div>
            <Button type="submit" size="sm">Guardar visita</Button>
          </form>
        </div>
      )}

      {/* ── ACTAS ─────────────────────────────────────────────────────────── */}
      {activeTab === "meeting_minutes" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Actas de reunion</h2>

          <div className="space-y-2">
            {(meetingMinutes ?? []).map((m) => {
              const del = deleteMeetingMinute.bind(null, requestId, m.id);
              return (
                <div key={m.id} className="flex items-start gap-2 rounded-lg border bg-card px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(m.meeting_date), "d MMM yyyy", { locale: es })}
                      {m.attendees && m.attendees.length > 0 && ` · ${m.attendees.join(", ")}`}
                      {!m.is_visible_to_client && " · oculta al cliente"}
                    </p>
                    {m.action_points && m.action_points.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.action_points.length} punto{m.action_points.length > 1 ? "s" : ""} de accion
                      </p>
                    )}
                  </div>
                  <form action={del}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" type="submit">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              );
            })}
            {(meetingMinutes ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin actas todavía.</p>
            )}
          </div>

          <form action={saveMinuteA} className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Nueva acta
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Titulo" required>
                <Input name="title" required placeholder="Reunion de seguimiento" />
              </Field>
              <Field label="Fecha de la reunion" required>
                <Input name="meeting_date" type="date" required />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Asistentes (uno por linea)">
                  <Textarea name="attendees" rows={2} placeholder={"Juan Garcia\nMaria Lopez"} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Resumen">
                  <Textarea name="summary" rows={3} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Puntos de accion (uno por linea)">
                  <Textarea name="action_points" rows={3} placeholder={"Enviar plano actualizado\nConfirmar suministro de materiales"} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <VisibleCheck />
              </div>
            </div>
            <Button type="submit" size="sm">Guardar acta</Button>
          </form>
        </div>
      )}

      {/* ── ECONOMICO ─────────────────────────────────────────────────────── */}
      {activeTab === "economic" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Control economico</h2>

          {/* Presupuesto base */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold">Presupuesto base</p>
            <form action={saveBudgetA} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="id" value={budget?.id ?? ""} />
              <Field label="Presupuesto inicial (EUR)">
                <Input
                  name="initial_budget"
                  type="number"
                  step="0.01"
                  defaultValue={budget?.initial_budget?.toString() ?? ""}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Moneda">
                <Select name="currency" defaultValue={budget?.currency ?? "EUR"} options={[
                  { value: "EUR", label: "EUR" },
                  { value: "USD", label: "USD" },
                ]} />
              </Field>
              <div className="flex items-end">
                <Button type="submit" size="sm">Guardar</Button>
              </div>
              <div className="sm:col-span-3">
                <Field label="Notas">
                  <Textarea name="notes" rows={2} defaultValue={budget?.notes ?? ""} />
                </Field>
              </div>
            </form>
          </div>

          {/* Partidas de coste */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              Partidas de coste
              {costItems && costItems.length > 0 && (
                <span className="ml-2 font-normal text-muted-foreground">
                  Total: {new Intl.NumberFormat("es-ES", { style: "currency", currency: budget?.currency ?? "EUR" })
                    .format(costItems.reduce((a, c) => a + c.amount, 0))}
                </span>
              )}
            </p>
            {(costItems ?? []).map((c) => {
              const del = deleteCostItem.bind(null, requestId, c.id);
              return (
                <div key={c.id} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{c.description}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{c.category}</span>
                    {c.is_approved && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">Aprobado</Badge>
                    )}
                  </div>
                  <span className="font-mono text-sm">
                    {new Intl.NumberFormat("es-ES", { style: "currency", currency: budget?.currency ?? "EUR" })
                      .format(c.amount)}
                  </span>
                  <form action={del}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" type="submit">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              );
            })}
            {(costItems ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin partidas todavía.</p>
            )}
          </div>

          <form action={saveCostItemA} className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Nueva partida
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Descripcion" required>
                <Input name="description" required placeholder="Concepto" />
              </Field>
              <Field label="Importe (EUR)" required>
                <Input name="amount" type="number" step="0.01" required placeholder="0.00" />
              </Field>
              <Field label="Categoria">
                <Select name="category" defaultValue="other" options={[
                  { value: "labor",       label: "Mano de obra" },
                  { value: "materials",   label: "Materiales" },
                  { value: "equipment",   label: "Equipos" },
                  { value: "subcontract", label: "Subcontratas" },
                  { value: "other",       label: "Otros" },
                ]} />
              </Field>
              <Field label="Fecha">
                <Input name="date" type="date" />
              </Field>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="is_approved" value="1" className="h-4 w-4" />
                  Partida aprobada
                </label>
              </div>
            </div>
            <Button type="submit" size="sm">Agregar partida</Button>
          </form>
        </div>
      )}

      {/* ── FOTOS ─────────────────────────────────────────────────────────── */}
      {activeTab === "photos" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Fotos de obra</h2>
            <span className="text-sm text-muted-foreground">{photos.length} foto{photos.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Grid de fotos */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((p) => {
                const del = deletePhoto.bind(null, requestId, p.id, p.storage_path);
                const toggleVisibility = updatePhotoVisibility.bind(null, requestId, p.id, !p.is_visible_to_client);
                return (
                  <div key={p.id} className="group relative overflow-hidden rounded-lg border bg-muted">
                    {p.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.signedUrl}
                        alt={p.caption ?? p.original_filename}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-muted-foreground/30 text-xs">
                        Sin preview
                      </div>
                    )}
                    {p.caption && (
                      <p className="px-1.5 py-1 text-[11px] text-muted-foreground truncate">
                        {p.caption}
                      </p>
                    )}
                    <p className="px-1.5 pb-1 text-[10px] text-muted-foreground">
                      Subida por {p.uploaded_by_role === "client" ? "cliente" : "Soltegra"}
                    </p>
                    <div className="flex gap-1 px-1.5 pb-1.5">
                      <form action={toggleVisibility} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          type="submit"
                          className="w-full text-[11px] h-7"
                          title={p.is_visible_to_client ? "Ocultar al cliente" : "Publicar al cliente"}
                        >
                          {p.is_visible_to_client ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </Button>
                      </form>
                      <form action={del}>
                        <Button variant="destructive" size="sm" className="h-7" type="submit" title="Eliminar foto">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {photos.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin fotos todavía.</p>
          )}

          {/* Uploader */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Subir fotos
            </p>
            <PhotoUploader requestId={requestId} organizationId={req.organization_id} />
          </div>
        </div>
      )}
    </div>
  );
}
