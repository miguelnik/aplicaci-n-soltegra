"use client";

// Acciones de oportunidad (botón "Editar" → Dialog + acciones rápidas).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, CheckCircle2, RefreshCcw, Pencil } from "lucide-react";
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
  const [pending, startTransition] = useTransition();

  // Acciones rápidas: cambio de stage directo
  function quickStage(stage: OpportunityStage) {
    startTransition(async () => {
      const res = await updateCrmOpportunity(o.id, { stage });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success(`Estado: ${STAGE_LABEL[stage]}`);
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Acciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Botón principal: Editar */}
        <EditDialog
          opportunity={o}
          organizations={organizations}
          contacts={contacts}
          services={services}
          workers={workers}
        />

        {/* Cambio rápido de estado */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cambiar estado</Label>
          <div className="grid grid-cols-2 gap-1">
            {ALL_STAGES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={o.stage === s ? "default" : "outline"}
                onClick={() => quickStage(s)}
                disabled={pending || o.stage === s}
                className="h-7 text-[11px]"
              >
                {STAGE_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>

        {/* Convertir a proyecto */}
        {!o.converted_to_request_id && o.stage === "won" && (
          <ConvertDialog opportunity={o} services={services} />
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

// ── Dialog de edición completa ───────────────────────────────────────────────

function EditDialog({
  opportunity, organizations, contacts, services, workers,
}: Pick<Props, "organizations" | "contacts" | "services" | "workers"> & { opportunity: OppData }) {
  const router = useRouter();
  const o = opportunity;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(o.title);
  const [stage, setStage] = useState(o.stage);
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
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar oportunidad</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={pending} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <select value={stage} onChange={(e) => setStage(e.target.value as OpportunityStage)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {ALL_STAGES.map((s) => (<option key={s} value={s}>{STAGE_LABEL[s]}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Servicio</Label>
              <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Sin servicio —</option>
                {services.map((x) => (<option key={x.id} value={x.id}>{x.name}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente (organización)</Label>
              <select value={organizationId} onChange={(e) => setOrgId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Sin cliente —</option>
                {organizations.map((x) => (<option key={x.id} value={x.id}>{x.name}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contacto</Label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Sin contacto —</option>
                {contacts.map((x) => (<option key={x.id} value={x.id}>{x.full_name}{x.company_name ? ` · ${x.company_name}` : ""}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comercial</Label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Sin comercial —</option>
                {workers.map((x) => (<option key={x.id} value={x.id}>{x.full_name ?? x.id.slice(0,8)}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor estimado (€)</Label>
              <Input type="number" min="0" step="0.01" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha estimada de cierre</Label>
              <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Probabilidad (%)</Label>
              <Input type="number" min="0" max="100" step="5" value={probability} onChange={(e) => setProbability(e.target.value)} disabled={pending} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Próxima acción (recordatorio)</Label>
              <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Ej: Llamar el martes…" disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha próxima acción</Label>
              <Input type="date" value={nextActionDue} onChange={(e) => setNextActionDue(e.target.value)} disabled={pending} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={pending} />
          </div>

          {stage === "lost" && (
            <div className="space-y-1">
              <Label className="text-xs">Motivo de pérdida</Label>
              <Textarea value={lostReason} onChange={(e) => setLostReason(e.target.value)} rows={2} disabled={pending} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={pending || !title.trim()}>
            {pending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog de conversión a proyecto ──────────────────────────────────────────

function ConvertDialog({
  opportunity,
  services,
}: {
  opportunity: OppData;
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const o = opportunity;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [convertSvc, setConvertSvc] = useState(o.service_type_id ?? "");
  const [convertAddress, setConvertAddress] = useState(o.title ?? "");

  function submit() {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <RefreshCcw className="h-3.5 w-3.5" />
          Convertir en proyecto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear proyecto desde esta oportunidad</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!o.organization_id && (
            <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Antes asigna un cliente (organización) en &ldquo;Editar&rdquo;.
            </p>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Servicio *</Label>
            <select value={convertSvc} onChange={(e) => setConvertSvc(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Selecciona servicio…</option>
              {services.map((x) => (<option key={x.id} value={x.id}>{x.name}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre / dirección del proyecto *</Label>
            <Input value={convertAddress} onChange={(e) => setConvertAddress(e.target.value)} disabled={pending} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !o.organization_id || !convertSvc} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Crear proyecto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
