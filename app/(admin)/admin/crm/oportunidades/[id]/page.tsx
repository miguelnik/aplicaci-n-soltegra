import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, User, Mail, Phone, ExternalLink, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { InteractionTimeline } from "@/components/admin/InteractionTimeline";
import { OpportunityEditClient } from "./OpportunityEditClient";
import { NewTaskButton } from "@/components/admin/NewTaskButton";
import { TaskItem } from "@/components/admin/TaskItem";
import {
  STAGE_LABEL, STAGE_COLOR,
  type OpportunityStage, type CrmInteractionWithAuthor,
} from "@/lib/crm/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

export default async function OpportunityDetailPage({ params }: Props) {
  const me = await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: opp } = await admin
    .from("crm_opportunities")
    .select(`
      *,
      contacts:contact_id ( id, full_name, email, phone, position ),
      organizations:organization_id ( id, name ),
      profiles:owner_id ( id, full_name ),
      service_types:service_type_id ( id, name )
    `)
    .eq("id", id)
    .single();

  if (!opp) notFound();

  // Cargar interacciones
  const { data: interRows } = await admin
    .from("crm_interactions")
    .select("*, profiles:created_by(full_name)")
    .eq("opportunity_id", id)
    .order("happened_at", { ascending: false });

  const interactions: CrmInteractionWithAuthor[] = (interRows ?? []).map((i) => ({
    id: i.id,
    contact_id: i.contact_id,
    opportunity_id: i.opportunity_id,
    kind: i.kind,
    happened_at: i.happened_at,
    subject: i.subject,
    summary: i.summary,
    direction: i.direction,
    created_by: i.created_by,
    created_at: i.created_at,
    author_name: (i.profiles as { full_name?: string | null } | null)?.full_name ?? null,
  }));

  // Cargar listas para el editor
  const [{ data: orgs }, { data: contacts }, { data: services }, { data: workers }] = await Promise.all([
    admin.from("organizations").select("id, name").order("name"),
    admin.from("crm_contacts").select("id, full_name, organization_id, company_name").order("full_name"),
    admin.from("service_types").select("id, name").eq("is_active", true).order("display_order").order("name"),
    admin.from("profiles").select("id, full_name").in("role", ["admin", "superadmin"]).order("full_name"),
  ]);

  // Tareas vinculadas a esta oportunidad
  const { data: oppTasksRaw } = await admin
    .from("user_tasks")
    .select("*, assignee:assignee_id(full_name), creator:created_by(full_name)")
    .eq("opportunity_id", id)
    .order("status", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false });
  const oppTasks = (oppTasksRaw ?? []);

  const stage = opp.stage as OpportunityStage;
  const contact = opp.contacts as { id: string; full_name: string; email: string | null; phone: string | null; position: string | null } | null;
  const org = opp.organizations as { id: string; name: string } | null;
  const owner = opp.profiles as { full_name: string | null } | null;
  const svc = opp.service_types as { name: string | null } | null;

  return (
    <div className="space-y-4">
      <Link href="/admin/crm/oportunidades" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a oportunidades
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{opp.title}</h2>
          <Badge variant="outline" className={STAGE_COLOR[stage]}>{STAGE_LABEL[stage]}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {!opp.converted_to_request_id && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/presupuestos/nuevo?opportunity=${id}`}>
                <FileText className="h-3.5 w-3.5" />
                Crear presupuesto
              </Link>
            </Button>
          )}
          {opp.converted_to_request_id && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/solicitudes/${opp.converted_to_request_id}`}>
                Ir al proyecto <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Resumen + acciones rápidas */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Información</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              {org && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <Link href={`/admin/clientes/${org.id}`} className="text-primary hover:underline">{org.name}</Link>
                </div>
              )}
              {contact && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <Link href={`/admin/crm/contactos/${contact.id}`} className="text-primary hover:underline">
                    {contact.full_name}{contact.position ? ` — ${contact.position}` : ""}
                  </Link>
                </div>
              )}
              {contact?.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                </div>
              )}
              {contact?.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
                </div>
              )}
            </div>

            <div className="grid gap-2 border-t pt-2 sm:grid-cols-2">
              {opp.estimated_value != null && (
                <div><span className="text-xs text-muted-foreground">Valor estimado:</span> <span className="font-mono font-semibold">{eur(Number(opp.estimated_value))}</span></div>
              )}
              {opp.expected_close_date && (
                <div><span className="text-xs text-muted-foreground">Cierre estimado:</span> <span className="font-medium">{format(parseISO(opp.expected_close_date), "d MMM yyyy", { locale: es })}</span></div>
              )}
              {opp.probability != null && (
                <div><span className="text-xs text-muted-foreground">Probabilidad:</span> <span className="font-medium">{opp.probability}%</span></div>
              )}
              {svc?.name && (
                <div><span className="text-xs text-muted-foreground">Servicio:</span> <span className="font-medium">{svc.name}</span></div>
              )}
              {owner?.full_name && (
                <div><span className="text-xs text-muted-foreground">Comercial:</span> <span className="font-medium">{owner.full_name}</span></div>
              )}
              {opp.next_action && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Próxima acción:</span>{" "}
                  <span className="font-medium">{opp.next_action}</span>
                  {opp.next_action_due && (
                    <span className="ml-1 text-xs text-muted-foreground">({format(parseISO(opp.next_action_due), "d MMM yyyy", { locale: es })})</span>
                  )}
                </div>
              )}
            </div>

            {opp.notes && (
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground">Notas:</p>
                <p className="whitespace-pre-line">{opp.notes}</p>
              </div>
            )}

            {stage === "lost" && opp.lost_reason && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
                <p className="text-xs font-semibold">Motivo de pérdida:</p>
                <p className="text-sm">{opp.lost_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Editor + acciones */}
        <OpportunityEditClient
          opportunity={{
            id: opp.id,
            title: opp.title,
            contact_id: opp.contact_id,
            organization_id: opp.organization_id,
            owner_id: opp.owner_id,
            stage,
            service_type_id: opp.service_type_id,
            estimated_value: opp.estimated_value != null ? Number(opp.estimated_value) : null,
            expected_close_date: opp.expected_close_date,
            probability: opp.probability,
            next_action: opp.next_action,
            next_action_due: opp.next_action_due,
            notes: opp.notes,
            lost_reason: opp.lost_reason,
            converted_to_request_id: opp.converted_to_request_id,
          }}
          organizations={orgs ?? []}
          contacts={contacts ?? []}
          services={services ?? []}
          workers={workers ?? []}
        />
      </div>

      {/* Tareas vinculadas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Tareas pendientes</CardTitle>
            <NewTaskButton
              currentUserId={me.id}
              workers={workers ?? []}
              opportunityId={id}
              contactId={opp.contact_id ?? null}
            />
          </div>
        </CardHeader>
        <CardContent>
          {oppTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tareas vinculadas. Crea una para recordar próximos pasos.</p>
          ) : (
            <div className="space-y-2">
              {oppTasks.map((t) => {
                const ass = (t.assignee as { full_name?: string | null } | null);
                const cr  = (t.creator  as { full_name?: string | null } | null);
                return (
                  <TaskItem
                    key={t.id}
                    item={{
                      source: "task",
                      id: t.id,
                      title: t.title,
                      description: t.description,
                      due_at: t.due_at,
                      priority: t.priority,
                      assignee_id: t.assignee_id,
                      assignee_name: ass?.full_name ?? null,
                      creator_name: cr?.full_name ?? null,
                      href: `/admin/crm/oportunidades/${id}`,
                      opportunity_id: id,
                      contact_id: t.contact_id,
                      request_id: t.request_id,
                      status: t.status === "done" ? "done" : "pending",
                    }}
                    showAssignee
                    canDelete
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline de comunicaciones */}
      <Card>
        <CardContent className="pt-4">
          <InteractionTimeline opportunityId={id} interactions={interactions} />
        </CardContent>
      </Card>
    </div>
  );
}
