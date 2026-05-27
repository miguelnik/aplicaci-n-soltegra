"use client";

// Creación de presupuesto en UNA sola pantalla.
// Form de cabecera + editor de partidas + selector de plantilla + biblioteca.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, FileText } from "lucide-react";
import { createBudget } from "@/lib/budgets/actions";
import {
  BudgetItemsEditor, type EditableItem, type LibraryConcept,
} from "@/components/admin/BudgetItemsEditor";

interface TemplateWithItems {
  id: string;
  name: string;
  service_type_id: string | null;
  items: Array<{
    concept: string;
    description: string | null;
    quantity: number;
    unit: string | null;
    unit_price: number;
    discount_pct: number;
  }>;
}

interface Props {
  organizations: { id: string; name: string }[];
  contacts: { id: string; full_name: string; organization_id: string | null; company_name: string | null }[];
  templates: TemplateWithItems[];
  library: LibraryConcept[];
  workers: { id: string; full_name: string | null }[];
  opportunities: { id: string; title: string; contact_id: string | null; organization_id: string | null; estimated_value: number | null }[];
  defaultVat: number;
  prefill: {
    opportunityId?: string;
    contactId?: string;
    organizationId?: string;
    title?: string;
  };
}

export function NewBudgetClient({
  organizations, contacts, templates, library, workers, opportunities, defaultVat, prefill,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // ── Cabecera
  const [title, setTitle] = useState(prefill.title ?? "");
  const [intro, setIntro] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [opportunityId, setOpportunityId] = useState(prefill.opportunityId ?? "");
  const [organizationId, setOrganizationId] = useState(prefill.organizationId ?? "");
  const [contactId, setContactId] = useState(prefill.contactId ?? "");
  const [ownerId, setOwnerId] = useState("");
  const [vatPct, setVatPct] = useState(String(defaultVat));
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  // ── Items
  const [items, setItems] = useState<EditableItem[]>([]);

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

  function applyTemplate(tplId: string) {
    if (!tplId) return;
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    const tplItems: EditableItem[] = tpl.items.map((it) => ({
      concept: it.concept,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unit_price: it.unit_price,
      discount_pct: it.discount_pct,
    }));
    if (items.length === 0) {
      setItems(tplItems);
    } else {
      const overwrite = confirm("Ya hay partidas. ¿Reemplazar por las de la plantilla? (Cancelar = añadir al final)");
      if (overwrite) setItems(tplItems);
      else setItems([...items, ...tplItems]);
    }
    toast.success(`Plantilla "${tpl.name}" aplicada (${tpl.items.length} partidas)`);
  }

  function submit() {
    if (!title.trim()) { toast.error("Falta el título"); return; }
    const vat = parseFloat(vatPct);
    if (Number.isNaN(vat) || vat < 0 || vat > 100) { toast.error("IVA inválido"); return; }
    const validItems = items.filter((it) => it.concept.trim());
    if (validItems.length === 0) {
      if (!confirm("No has añadido partidas todavía. ¿Crear igualmente?")) return;
    }

    startTransition(async () => {
      const res = await createBudget({
        title,
        intro: intro || null,
        projectLocation: projectLocation || null,
        opportunityId: opportunityId || null,
        organizationId: organizationId || null,
        contactId: contactId || null,
        ownerId: ownerId || undefined,
        vatPct: vat,
        validUntil: validUntil || null,
        items: validItems.map((it) => ({
          concept: it.concept,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unit_price,
          discountPct: it.discount_pct,
        })),
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success(`Presupuesto ${res.number ?? ""} creado`);
      router.push(`/admin/presupuestos/${res.id}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Cabecera + relaciones */}
      <Card>
        <CardHeader><CardTitle className="text-base">Datos del presupuesto</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Título / Proyecto *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Remodelación oficina corporativa" disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ubicación del proyecto (aparece en el PDF)</Label>
              <Input value={projectLocation} onChange={(e) => setProjectLocation(e.target.value)} placeholder="C/ Real 12, Granada" disabled={pending} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Objeto del presupuesto (texto introductorio del PDF)</Label>
            <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} placeholder="Descripción del alcance, motivación del trabajo…" disabled={pending} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <Label className="text-xs">Oportunidad relacionada</Label>
              <select value={opportunityId} onChange={(e) => pickOpportunity(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Ninguna —</option>
                {opportunities.map((o) => (<option key={o.id} value={o.id}>{o.title}</option>))}
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
            <div className="space-y-1">
              <Label className="text-xs">Comercial</Label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Yo —</option>
                {workers.map((w) => (<option key={w.id} value={w.id}>{w.full_name ?? w.id.slice(0,8)}</option>))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Partidas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Partidas
            </CardTitle>
            {templates.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Aplicar plantilla:</Label>
                <select
                  onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }}
                  disabled={pending}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  defaultValue=""
                >
                  <option value="">— Elegir plantilla —</option>
                  {templates.map((t) => (<option key={t.id} value={t.id}>{t.name} ({t.items.length})</option>))}
                </select>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Añade partidas a mano, desde la biblioteca, o aplica una plantilla. Los totales se actualizan en vivo.
          </p>
        </CardHeader>
        <CardContent>
          <BudgetItemsEditor
            items={items}
            onChange={setItems}
            vatPct={parseFloat(vatPct) || 21}
            library={library}
            disabled={pending}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending || !title.trim()}>
          <Save className="h-4 w-4" />
          {pending ? "Creando..." : "Crear presupuesto"}
        </Button>
        <Button variant="ghost" onClick={() => router.back()} disabled={pending}>Cancelar</Button>
      </div>
    </div>
  );
}
