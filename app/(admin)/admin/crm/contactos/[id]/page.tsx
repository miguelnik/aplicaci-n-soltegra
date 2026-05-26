import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Phone, Building2, ExternalLink } from "lucide-react";
import { InteractionTimeline } from "@/components/admin/InteractionTimeline";
import { ContactEditClient } from "./ContactEditClient";
import {
  STAGE_LABEL, STAGE_COLOR,
  type OpportunityStage, type CrmInteractionWithAuthor,
} from "@/lib/crm/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0,
});

export default async function ContactDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: c } = await admin
    .from("crm_contacts")
    .select(`
      *,
      organizations:organization_id ( id, name ),
      profiles:owner_id ( full_name )
    `)
    .eq("id", id)
    .single();
  if (!c) notFound();

  // Interacciones de este contacto
  const { data: interRows } = await admin
    .from("crm_interactions")
    .select("*, profiles:created_by(full_name)")
    .eq("contact_id", id)
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

  // Oportunidades asociadas al contacto
  const { data: oppRows } = await admin
    .from("crm_opportunities")
    .select("id, title, stage, estimated_value, expected_close_date")
    .eq("contact_id", id)
    .order("updated_at", { ascending: false });

  // Para el editor
  const [{ data: orgs }, { data: workers }] = await Promise.all([
    admin.from("organizations").select("id, name").order("name"),
    admin.from("profiles").select("id, full_name").in("role", ["admin", "superadmin"]).order("full_name"),
  ]);

  const org = c.organizations as { id: string; name: string } | null;
  const owner = c.profiles as { full_name: string | null } | null;

  return (
    <div className="space-y-4">
      <Link href="/admin/crm/contactos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a contactos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{c.full_name}</h2>
        <Button asChild size="sm">
          <Link href={`/admin/crm/oportunidades/nueva?contact=${c.id}`}>
            Nueva oportunidad para este contacto
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Datos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {c.position && (
              <div><span className="text-xs text-muted-foreground">Cargo:</span> <span className="font-medium">{c.position}</span></div>
            )}
            {(c.company_name || org) && (
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {org ? (
                  <Link href={`/admin/clientes/${org.id}`} className="text-primary hover:underline">{org.name}</Link>
                ) : (
                  <span>{c.company_name}</span>
                )}
              </div>
            )}
            {c.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a>
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`tel:${c.phone}`} className="text-primary hover:underline">{c.phone}</a>
              </div>
            )}
            {owner?.full_name && (
              <div><span className="text-xs text-muted-foreground">Comercial:</span> <span className="font-medium">{owner.full_name}</span></div>
            )}
            {c.notes && (
              <div className="sm:col-span-2 border-t pt-2">
                <p className="text-xs text-muted-foreground">Notas:</p>
                <p className="whitespace-pre-line">{c.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <ContactEditClient
          contact={{
            id: c.id,
            full_name: c.full_name,
            email: c.email,
            phone: c.phone,
            position: c.position,
            organization_id: c.organization_id,
            company_name: c.company_name,
            notes: c.notes,
            owner_id: c.owner_id,
          }}
          organizations={orgs ?? []}
          workers={workers ?? []}
        />
      </div>

      {/* Oportunidades */}
      {(oppRows ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Oportunidades</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(oppRows ?? []).map((o) => (
                <li key={o.id} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                  <Link href={`/admin/crm/oportunidades/${o.id}`} className="text-sm font-medium text-primary hover:underline">
                    {o.title}
                  </Link>
                  <div className="flex items-center gap-3 text-xs">
                    {o.estimated_value != null && <span className="font-mono">{eur(Number(o.estimated_value))}</span>}
                    <Badge variant="outline" className={STAGE_COLOR[o.stage as OpportunityStage]}>
                      {STAGE_LABEL[o.stage as OpportunityStage]}
                    </Badge>
                    <Link href={`/admin/crm/oportunidades/${o.id}`} className="text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardContent className="pt-4">
          <InteractionTimeline contactId={id} interactions={interactions} />
        </CardContent>
      </Card>
    </div>
  );
}
