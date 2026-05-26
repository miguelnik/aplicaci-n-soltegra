"use client";

// Editor inline de una oportunidad + acciones (convertir, eliminar).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, CheckCircle2, RefreshCcw } from "lucide-react";
import {
  updateCrmOpportunity, deleteCrmOpportunity, convertOpportunityToProject,
} from "@/lib/crm/actions";
import { ALL_STAGES, STAGE_LABEL, type OpportunityStage } from "@/lib/crm/types";

interface OppData {
  id: string;
  title: string;
  contact_id: string | null;
  organization_id: string | null;
  owner_id: string | null;
  stage: OpportunityStage;
  service_type_id: string | null;
  estimated_value: number | null;
  expected_close_date: string | null;
  probability: number | null;
  next_action: string | null;
  next_action_due: string | null;
  notes: string | null;
  lost_reason: string | null;
  converted_to_request_id: string | null;
}

interface Props {
  opportunity: OppData;
  organizations: { id: string; name: string }[];
  contacts: { id: string; full_name: string; company_name: string | null }[];
  services: { id: string; name: string }[];
  workers: { id: string; full_name: string | null }[];
}

export function OpportunityEditClient({ opportunity, organizations, contacts, services, workers }: Props) {
  const router = useRouter();
  const o = opportunity;
  const [stage, setStage] = useState(o.stage);
  const [title, setTitle] = useState(o.title);
  const [contactId, setContactId] = useState(o.contact_id ?? "");
  const [organizationId, setOrgId] = useState(o.organization_id ?? "");
  const [serviceTypeId, setServiceTypeId] = useState(o.service_type_id ?? "");
  const [estimatedValue, setEstimatedValue] = useState(o.estimated_value != null ? String(o.estimated_value) : "");
  const [expectedCloseDate, setExpectedCloseDate] = useState(o.expected_close_date ?? "");
  const [probability, setProbability] = useState(o.probability != null ? String(o.probability) : "");
  const [nextAction, setNextAction] = useState(o.next_action ?? "");
  const [nextActionDue, setNextActionDue] = useState(o.next_action_due ?? "");
  const [ownerId, setOwnerId] = useState(o.owner_id ?? "");
  const [notes, setNotes] = useState(o.notes ?? "");
  const [lostReason, setLostReason] = useState(o.lost_reason ?? "");
  const [pending, startTransition] = useTransition();

  // Conversión
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertSvc, setConvertSvc] = useState(o.service_type_id ?? "");
  const [convertAddress, setConvertAddress] = useState(o.title ?? "");

  function save() {
    if (!title.trim()) { toast.error("Falta título"); return; }
    const v = estimatedValue ? parseFloat(estimatedValue) : null;
    const p = probability ? parseInt(probability) : null;

    startTransition(async () => {
      const res = await updateCrmOpportunity(o.id, {
        title,
        contactId: contactId || null,
        organizationId: organizationId || null,
        ownerId: ownerId || null,
        stage,
        serviceTypeId: serviceTypeId || null,
        estimatedValue: v,
        expectedCloseDate: expectedCloseDate || null,
        probability: p,
        nextAction: nextAction || null,
        nextActionDue: nextActionDue || null,
        notes: notes || null,
        lostReason: stage === "lost" ? lostReason : null,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Oportunidad actualizada");
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("¿Eliminar esta oportunidad?")) return;
    startTransition(async () => {
      const res = await deleteCrmOpportunity(o.id);
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Oportunidad eliminada");
      router.push("/admin/crm/oportunidades");
    });
  }

  function convert() {
    if (!convertSvc) { toast.error("Selecciona el servicio"); return; }
    if (!convertAddress.trim()) { toast.error("Falta el nombre del proyecto"); return; }
    startTransition(async () => {
      const res = await convertOpportunityToProject(o.id, convertSvc, convertAddress.trim());
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Convertido en proyecto");
      router.push(`/admin/solicitudes/${res.requestId}`);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Editar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Estado *</Label>
          <select value={stage} onChange={(e) => setStage(e.target.value as OpportunityStage)} disabled={pending} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
            {ALL_STAGES.map((s) => (<option key={s} value={s}>{STAGE_LABEL[s]}</option>))}
          </select>
        </div>

        <details className="space-y-2 rounded-md border bg-muted/30 p-2 text-xs">
          <summary className="cursor-pointer font-medium">Todos los campos</summary>
          <div className="space-y-2 pt-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="h-8 text-sm" disabled={pending} />
            <select value={organizationId} onChange={(e) => setOrgId(e.target.value)} disabled={pending} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Sin cliente —</option>
              {organizations.map((x) => (<option key={x.id} value={x.id}>{x.name}</option>))}
            </select>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={pending} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Sin contacto —</option>
              {contacts.map((x) => (<option key={x.id} value={x.id}>{x.full_name}{x.company_name ? ` · ${x.company_name}` : ""}</option>))}
            </select>
            <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} disabled={pending} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Sin servicio —</option>
              {services.map((x) => (<option key={x.id} value={x.id}>{x.name}</option>))}
            </select>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={pending} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Sin comercial —</option>
              {workers.map((x) => (<option key={x.id} value={x.id}>{x.full_name ?? x.id.slice(0,8)}</option>))}
            </select>
            <Input type="number" min="0" step="0.01" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} placeholder="Valor estimado (€)" className="h-8 text-sm" disabled={pending} />
            <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} className="h-8 text-sm" disabled={pending} />
            <Input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder="Probabilidad (%)" className="h-8 text-sm" disabled={pending} />
            <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Próxima acción" className="h-8 text-sm" disabled={pending} />
            <Input type="date" value={nextActionDue} onChange={(e) => setNextActionDue(e.target.value)} className="h-8 text-sm" disabled={pending} />
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notas" className="text-sm" disabled={pending} />
            {stage === "lost" && (
              <Textarea value={lostReason} onChange={(e) => setLostReason(e.target.value)} rows={2} placeholder="Motivo de pérdida" className="text-sm" disabled={pending} />
            )}
          </div>
        </details>

        <Button size="sm" onClick={save} disabled={pending} className="w-full">
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>

        {/* Convertir a proyecto */}
        {!o.converted_to_request_id && (
          <div className="border-t pt-3">
            {!convertOpen ? (
              <Button size="sm" variant="outline" onClick={() => setConvertOpen(true)} className="w-full">
                <RefreshCcw className="h-3.5 w-3.5" />
                Convertir en proyecto
              </Button>
            ) : (
              <div className="space-y-2 rounded-md border bg-primary/5 p-2">
                <p className="text-xs font-medium">Crear proyecto desde esta oportunidad</p>
                {!organizationId && (
                  <p className="text-[11px] text-rose-600">
                    Antes asigna un cliente (organización) y guarda.
                  </p>
                )}
                <select value={convertSvc} onChange={(e) => setConvertSvc(e.target.value)} disabled={pending} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">Selecciona servicio…</option>
                  {services.map((x) => (<option key={x.id} value={x.id}>{x.name}</option>))}
                </select>
                <Input
                  value={convertAddress}
                  onChange={(e) => setConvertAddress(e.target.value)}
                  placeholder="Nombre / dirección del proyecto"
                  className="h-8 text-sm"
                  disabled={pending}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={convert} disabled={pending || !organizationId || !convertSvc} className="flex-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Crear proyecto
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConvertOpen(false)} disabled={pending}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t pt-2">
          <Button size="sm" variant="ghost" onClick={remove} disabled={pending} className="w-full text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar oportunidad
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
