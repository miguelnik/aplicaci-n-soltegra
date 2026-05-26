"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createCrmOpportunity } from "@/lib/crm/actions";
import { ALL_STAGES, STAGE_LABEL, type OpportunityStage } from "@/lib/crm/types";

interface Props {
  organizations: { id: string; name: string }[];
  contacts: { id: string; full_name: string; organization_id: string | null; company_name: string | null }[];
  services: { id: string; name: string }[];
  workers: { id: string; full_name: string | null }[];
}

export function NewOpportunityClient({ organizations, contacts, services, workers }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [organizationId, setOrgId] = useState("");
  const [stage, setStage] = useState<OpportunityStage>("lead");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [probability, setProbability] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDue, setNextActionDue] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim()) { toast.error("Falta el título"); return; }
    const v = estimatedValue ? parseFloat(estimatedValue) : null;
    if (v != null && (Number.isNaN(v) || v < 0)) { toast.error("Valor inválido"); return; }
    const p = probability ? parseInt(probability) : null;
    if (p != null && (Number.isNaN(p) || p < 0 || p > 100)) { toast.error("Probabilidad 0-100"); return; }

    startTransition(async () => {
      const res = await createCrmOpportunity({
        title,
        contactId: contactId || null,
        organizationId: organizationId || null,
        ownerId: ownerId || undefined,
        stage,
        serviceTypeId: serviceTypeId || null,
        estimatedValue: v,
        expectedCloseDate: expectedCloseDate || null,
        probability: p,
        nextAction: nextAction || null,
        nextActionDue: nextActionDue || null,
        notes: notes || null,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Oportunidad creada");
      router.push(`/admin/crm/oportunidades/${res.id}`);
    });
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader><CardTitle className="text-base">Datos de la oportunidad</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Título *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: CEE vivienda calle Real" disabled={pending} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Cliente (organización)</Label>
            <select value={organizationId} onChange={(e) => setOrgId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Ninguno —</option>
              {organizations.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contacto</Label>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Ninguno —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}{c.company_name ? ` · ${c.company_name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Servicio (producto)</Label>
            <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Sin especificar —</option>
              {services.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <select value={stage} onChange={(e) => setStage(e.target.value as OpportunityStage)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              {ALL_STAGES.map((s) => (<option key={s} value={s}>{STAGE_LABEL[s]}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor estimado (€)</Label>
            <Input type="number" min="0" step="0.01" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} placeholder="0.00" disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fecha estimada de cierre</Label>
            <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Probabilidad (%)</Label>
            <Input type="number" min="0" max="100" step="5" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder="0-100" disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Comercial</Label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Yo —</option>
              {workers.map((w) => (<option key={w.id} value={w.id}>{w.full_name ?? w.id.slice(0,8)}</option>))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Próxima acción</Label>
            <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Ej: Llamar la próxima semana" disabled={pending} />
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

        <div className="flex gap-2 pt-2">
          <Button onClick={submit} disabled={pending || !title.trim()}>
            {pending ? "Creando..." : "Crear oportunidad"}
          </Button>
          <Button variant="ghost" onClick={() => router.back()} disabled={pending}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
