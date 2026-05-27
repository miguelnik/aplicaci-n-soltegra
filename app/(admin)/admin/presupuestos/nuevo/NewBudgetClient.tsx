"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createBudget } from "@/lib/budgets/actions";

interface Props {
  organizations: { id: string; name: string }[];
  contacts: { id: string; full_name: string; organization_id: string | null; company_name: string | null }[];
  templates: { id: string; name: string; service_type_id: string | null }[];
  workers: { id: string; full_name: string | null }[];
  opportunities: { id: string; title: string; contact_id: string | null; organization_id: string | null; estimated_value: number | null }[];
  prefill: {
    opportunityId?: string;
    contactId?: string;
    organizationId?: string;
    title?: string;
  };
}

export function NewBudgetClient({ organizations, contacts, templates, workers, opportunities, prefill }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(prefill.title ?? "");
  const [intro, setIntro] = useState("");
  const [opportunityId, setOpportunityId] = useState(prefill.opportunityId ?? "");
  const [organizationId, setOrganizationId] = useState(prefill.organizationId ?? "");
  const [contactId, setContactId] = useState(prefill.contactId ?? "");
  const [ownerId, setOwnerId] = useState("");
  const [vatPct, setVatPct] = useState("21");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [templateId, setTemplateId] = useState("");

  function pickOpportunity(id: string) {
    setOpportunityId(id);
    if (!id) return;
    const opp = opportunities.find((o) => o.id === id);
    if (opp) {
      if (!title) setTitle(opp.title);
      if (opp.contact_id) setContactId(opp.contact_id);
      if (opp.organization_id) setOrganizationId(opp.organization_id);
    }
  }

  function submit() {
    if (!title.trim()) { toast.error("Falta el título"); return; }
    const vat = parseFloat(vatPct);
    if (Number.isNaN(vat) || vat < 0 || vat > 100) { toast.error("IVA inválido"); return; }

    startTransition(async () => {
      const res = await createBudget({
        title,
        intro: intro || null,
        opportunityId: opportunityId || null,
        organizationId: organizationId || null,
        contactId: contactId || null,
        ownerId: ownerId || undefined,
        vatPct: vat,
        validUntil: validUntil || null,
        fromTemplateId: templateId || null,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success(`Presupuesto ${res.number ?? ""} creado`);
      router.push(`/admin/presupuestos/${res.id}`);
    });
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader><CardTitle className="text-base">Datos del presupuesto</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Título *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Certificado energético vivienda calle Real 12" disabled={pending} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Introducción (opcional)</Label>
          <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} placeholder="Texto descriptivo que aparece debajo del título en el PDF" disabled={pending} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Oportunidad relacionada (opcional)</Label>
            <select value={opportunityId} onChange={(e) => pickOpportunity(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Ninguna —</option>
              {opportunities.map((o) => (<option key={o.id} value={o.id}>{o.title}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Plantilla (opcional)</Label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Empezar en blanco —</option>
              {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
            {templateId && (<p className="text-[11px] text-muted-foreground">Las partidas de la plantilla se copiarán al presupuesto.</p>)}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Cliente</Label>
            <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Sin cliente —</option>
              {organizations.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contacto</Label>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Sin contacto —</option>
              {contacts.map((c) => (<option key={c.id} value={c.id}>{c.full_name}{c.company_name ? ` · ${c.company_name}` : ""}</option>))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">IVA (%)</Label>
            <Input type="number" min="0" max="100" step="0.5" value={vatPct} onChange={(e) => setVatPct(e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Válido hasta</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Comercial</Label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Yo —</option>
              {workers.map((w) => (<option key={w.id} value={w.id}>{w.full_name ?? w.id.slice(0,8)}</option>))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={submit} disabled={pending || !title.trim()}>
            {pending ? "Creando..." : "Crear y editar partidas"}
          </Button>
          <Button variant="ghost" onClick={() => router.back()} disabled={pending}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
