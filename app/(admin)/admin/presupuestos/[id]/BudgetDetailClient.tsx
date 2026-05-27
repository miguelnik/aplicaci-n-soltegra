"use client";

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
import {
  Save, Pencil, Trash2, Send, CheckCircle2, XCircle, RefreshCcw, FileBox,
} from "lucide-react";
import {
  updateBudget, saveBudgetItems, setBudgetStatus, deleteBudget, convertBudgetToProject,
} from "@/lib/budgets/actions";
import {
  BudgetItemsEditor, type EditableItem, type LibraryConcept,
} from "@/components/admin/BudgetItemsEditor";
import {
  type BudgetStatus, BUDGET_STATUS_LABEL,
} from "@/lib/budgets/types";

interface BudgetData {
  id: string;
  number: string | null;
  title: string;
  intro: string | null;
  vat_pct: number;
  issue_date: string;
  valid_until: string | null;
  status: BudgetStatus;
  rejection_reason: string | null;
  contact_id: string | null;
  organization_id: string | null;
  opportunity_id: string | null;
  owner_id: string | null;
  converted_to_request_id: string | null;
  client_legal_name: string | null;
  client_cif: string | null;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
  payment_terms: string | null;
  legal_notes: string | null;
}

interface Props {
  budget: BudgetData;
  initialItems: EditableItem[];
  organizations: { id: string; name: string }[];
  contacts: { id: string; full_name: string; organization_id: string | null; company_name: string | null }[];
  services: { id: string; name: string }[];
  workers: { id: string; full_name: string | null }[];
  opportunities: { id: string; title: string }[];
  library?: LibraryConcept[];
}

export function BudgetDetailClient({ budget, initialItems, organizations, contacts, services, workers, opportunities, library }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<EditableItem[]>(initialItems);
  const [savingItems, setSavingItems] = useState(false);

  function persistItems() {
    setSavingItems(true);
    startTransition(async () => {
      const res = await saveBudgetItems(budget.id, {
        items: items
          .filter((it) => it.concept.trim())
          .map((it) => ({
            concept: it.concept,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unit_price,
            discountPct: it.discount_pct,
          })),
      });
      setSavingItems(false);
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Partidas guardadas");
      router.refresh();
    });
  }

  function quickStatus(newStatus: BudgetStatus) {
    if (budget.status === newStatus) return;
    let rejReason: string | null = null;
    if (newStatus === "rejected") {
      rejReason = prompt("Motivo del rechazo (opcional):") || null;
    }
    startTransition(async () => {
      const res = await setBudgetStatus(budget.id, newStatus, rejReason);
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success(`Estado: ${BUDGET_STATUS_LABEL[newStatus]}`);
      router.refresh();
    });
  }

  function removeBudget() {
    if (!confirm(`¿Eliminar el presupuesto ${budget.number ?? ""}?`)) return;
    startTransition(async () => {
      const res = await deleteBudget(budget.id);
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Presupuesto eliminado");
      router.push("/admin/presupuestos");
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Columna izquierda: partidas */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Partidas</CardTitle>
            <Button size="sm" onClick={persistItems} disabled={pending || savingItems}>
              <Save className="h-3.5 w-3.5" />
              {savingItems ? "Guardando..." : "Guardar partidas"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <BudgetItemsEditor
            items={items}
            onChange={setItems}
            vatPct={Number(budget.vat_pct)}
            library={library}
            disabled={pending || budget.status === "accepted"}
          />
        </CardContent>
      </Card>

      {/* Columna derecha: acciones */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Acciones</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EditDialog
            budget={budget}
            organizations={organizations}
            contacts={contacts}
            workers={workers}
            opportunities={opportunities}
          />

          {/* Cambio de estado */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <div className="grid grid-cols-1 gap-1">
              {budget.status === "draft" && (
                <Button size="sm" variant="outline" onClick={() => quickStatus("sent")} disabled={pending}>
                  <Send className="h-3.5 w-3.5" /> Marcar como enviado
                </Button>
              )}
              {(budget.status === "draft" || budget.status === "sent") && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => quickStatus("accepted")} disabled={pending}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como aceptado
                </Button>
              )}
              {(budget.status === "draft" || budget.status === "sent") && (
                <Button size="sm" variant="outline" className="text-rose-600" onClick={() => quickStatus("rejected")} disabled={pending}>
                  <XCircle className="h-3.5 w-3.5" /> Marcar como rechazado
                </Button>
              )}
              {budget.status !== "draft" && budget.status !== "accepted" && (
                <Button size="sm" variant="ghost" onClick={() => quickStatus("draft")} disabled={pending}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Volver a borrador
                </Button>
              )}
            </div>
          </div>

          {/* Convertir a proyecto */}
          {budget.status === "accepted" && !budget.converted_to_request_id && (
            <ConvertDialog budget={budget} services={services} />
          )}

          <div className="border-t pt-2">
            <Button size="sm" variant="ghost" onClick={removeBudget} disabled={pending} className="w-full text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar presupuesto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Dialog editar cabecera ───────────────────────────────────────────────────

function EditDialog({
  budget, organizations, contacts, workers, opportunities,
}: {
  budget: BudgetData;
  organizations: { id: string; name: string }[];
  contacts: { id: string; full_name: string; organization_id: string | null; company_name: string | null }[];
  workers: { id: string; full_name: string | null }[];
  opportunities: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const b = budget;
  const [title, setTitle] = useState(b.title);
  const [intro, setIntro] = useState(b.intro ?? "");
  const [vatPct, setVatPct] = useState(String(b.vat_pct));
  const [issueDate, setIssueDate] = useState(b.issue_date);
  const [validUntil, setValidUntil] = useState(b.valid_until ?? "");
  const [organizationId, setOrgId] = useState(b.organization_id ?? "");
  const [contactId, setContactId] = useState(b.contact_id ?? "");
  const [opportunityId, setOppId] = useState(b.opportunity_id ?? "");
  const [ownerId, setOwnerId] = useState(b.owner_id ?? "");
  const [clientLegalName, setClientLegalName] = useState(b.client_legal_name ?? "");
  const [clientCif, setClientCif] = useState(b.client_cif ?? "");
  const [clientAddress, setClientAddress] = useState(b.client_address ?? "");
  const [clientEmail, setClientEmail] = useState(b.client_email ?? "");
  const [clientPhone, setClientPhone] = useState(b.client_phone ?? "");
  const [paymentTerms, setPaymentTerms] = useState(b.payment_terms ?? "");
  const [legalNotes, setLegalNotes] = useState(b.legal_notes ?? "");

  function save() {
    if (!title.trim()) { toast.error("Falta el título"); return; }
    const vat = parseFloat(vatPct);
    if (Number.isNaN(vat) || vat < 0 || vat > 100) { toast.error("IVA inválido"); return; }

    startTransition(async () => {
      const res = await updateBudget(b.id, {
        title, intro: intro || null,
        vatPct: vat,
        issueDate, validUntil: validUntil || null,
        organizationId: organizationId || null,
        contactId: contactId || null,
        opportunityId: opportunityId || null,
        ownerId: ownerId || null,
        clientLegalName: clientLegalName || null,
        clientCif: clientCif || null,
        clientAddress: clientAddress || null,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        paymentTerms: paymentTerms || null,
        legalNotes: legalNotes || null,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Guardado");
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
        <DialogHeader><DialogTitle>Editar presupuesto</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Introducción</Label>
            <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} disabled={pending} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Fecha emisión</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Válido hasta</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IVA (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={vatPct} onChange={(e) => setVatPct(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comercial</Label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Sin asignar —</option>
                {workers.map((w) => (<option key={w.id} value={w.id}>{w.full_name ?? w.id.slice(0,8)}</option>))}
              </select>
            </div>
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
                {contacts.map((c) => (<option key={c.id} value={c.id}>{c.full_name}{c.company_name ? ` · ${c.company_name}` : ""}</option>))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Oportunidad vinculada</Label>
              <select value={opportunityId} onChange={(e) => setOppId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Ninguna —</option>
                {opportunities.map((o) => (<option key={o.id} value={o.id}>{o.title}</option>))}
              </select>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Datos del cliente que aparecen en el PDF</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Nombre / razón social</Label>
                <Input value={clientLegalName} onChange={(e) => setClientLegalName(e.target.value)} disabled={pending} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CIF / NIF</Label>
                <Input value={clientCif} onChange={(e) => setClientCif(e.target.value)} disabled={pending} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Dirección</Label>
                <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} disabled={pending} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} disabled={pending} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} disabled={pending} />
              </div>
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Condiciones del PDF</p>
            <div className="space-y-1">
              <Label className="text-xs">Condiciones de pago</Label>
              <Textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={2} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas legales</Label>
              <Textarea value={legalNotes} onChange={(e) => setLegalNotes(e.target.value)} rows={2} disabled={pending} />
            </div>
          </div>
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

// ── Dialog conversión a proyecto ─────────────────────────────────────────────

function ConvertDialog({
  budget, services,
}: { budget: BudgetData; services: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serviceId, setServiceId] = useState("");
  const [address, setAddress] = useState(budget.title);

  function submit() {
    if (!serviceId) { toast.error("Selecciona el servicio"); return; }
    if (!address.trim()) { toast.error("Falta el nombre del proyecto"); return; }
    startTransition(async () => {
      const res = await convertBudgetToProject(budget.id, serviceId, address.trim());
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Convertido en proyecto");
      router.push(`/admin/solicitudes/${res.requestId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <FileBox className="h-3.5 w-3.5" />
          Convertir en proyecto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Crear proyecto desde este presupuesto</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          {!budget.organization_id && (
            <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Antes asigna un cliente al presupuesto (en &ldquo;Editar&rdquo;).
            </p>
          )}
          <p className="text-muted-foreground">El proyecto se creará con el cliente del presupuesto y el precio (base + IVA) como precio acordado.</p>
          <div className="space-y-1">
            <Label className="text-xs">Servicio *</Label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Selecciona…</option>
              {services.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre / dirección del proyecto *</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={pending} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !budget.organization_id || !serviceId}>
            Crear proyecto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
