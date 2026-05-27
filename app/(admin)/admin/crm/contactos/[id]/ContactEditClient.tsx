"use client";

// Acciones de contacto: botón "Editar" → Dialog, "Convertir en cliente", "Eliminar".

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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Pencil, UserCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { updateCrmContact, deleteCrmContact } from "@/lib/crm/actions";
import { convertContactToClient } from "@/lib/crm/client-sync";

interface ContactData {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  organization_id: string | null;
  company_name: string | null;
  notes: string | null;
  owner_id: string | null;
  linked_user_id: string | null;
}

interface Props {
  contact: ContactData;
  organizations: { id: string; name: string }[];
  workers: { id: string; full_name: string | null }[];
}

export function ContactEditClient({ contact, organizations, workers }: Props) {
  const router = useRouter();
  const c = contact;
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm("¿Eliminar este contacto? Las oportunidades asociadas perderán la referencia.")) return;
    startTransition(async () => {
      const res = await deleteCrmContact(c.id);
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Contacto eliminado");
      router.push("/admin/crm/contactos");
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Acciones</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <EditContactDialog contact={c} organizations={organizations} workers={workers} />

        {/* Sincronización con cliente */}
        {c.linked_user_id ? (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            <p className="flex items-center gap-1.5 font-medium">
              <UserCheck className="h-3.5 w-3.5" />
              Convertido en cliente
            </p>
            {c.organization_id && (
              <Link href={`/admin/clientes/${c.organization_id}`} className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
                Ver cliente <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        ) : (
          <ConvertToClientDialog contact={c} organizations={organizations} />
        )}

        <div className="border-t pt-2">
          <Button size="sm" variant="ghost" onClick={remove} disabled={pending} className="w-full text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar contacto
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Dialog editar contacto ───────────────────────────────────────────────────

function EditContactDialog({
  contact, organizations, workers,
}: {
  contact: ContactData;
  organizations: { id: string; name: string }[];
  workers: { id: string; full_name: string | null }[];
}) {
  const router = useRouter();
  const c = contact;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(c.full_name);
  const [email, setEmail] = useState(c.email ?? "");
  const [phone, setPhone] = useState(c.phone ?? "");
  const [position, setPosition] = useState(c.position ?? "");
  const [organizationId, setOrgId] = useState(c.organization_id ?? "");
  const [companyName, setCompanyName] = useState(c.company_name ?? "");
  const [ownerId, setOwnerId] = useState(c.owner_id ?? "");
  const [notes, setNotes] = useState(c.notes ?? "");

  function save() {
    if (!fullName.trim()) { toast.error("Falta el nombre"); return; }
    startTransition(async () => {
      const res = await updateCrmContact(c.id, {
        fullName,
        email: email || null,
        phone: phone || null,
        position: position || null,
        organizationId: organizationId || null,
        companyName: companyName || null,
        ownerId: ownerId || null,
        notes: notes || null,
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar contacto</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={pending} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Teléfono</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cargo</Label>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Empresa (texto libre)</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente vinculado</Label>
              <select value={organizationId} onChange={(e) => setOrgId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Ninguno —</option>
                {organizations.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comercial responsable</Label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">— Sin asignar —</option>
                {workers.map((w) => (<option key={w.id} value={w.id}>{w.full_name ?? w.id.slice(0,8)}</option>))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={pending} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={pending || !fullName.trim()}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog convertir en cliente ──────────────────────────────────────────────

function ConvertToClientDialog({
  contact, organizations,
}: { contact: ContactData; organizations: { id: string; name: string }[] }) {
  const router = useRouter();
  const c = contact;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [orgMode, setOrgMode] = useState<"existing" | "new">(c.organization_id ? "existing" : "new");
  const [orgId, setOrgId] = useState(c.organization_id ?? "");
  const [newOrgName, setNewOrgName] = useState(c.company_name ?? "");
  const [sendInvite, setSendInvite] = useState(true);

  function submit() {
    if (!c.email?.trim()) { toast.error("El contacto necesita un email para crear un usuario"); return; }
    if (orgMode === "existing" && !orgId) { toast.error("Selecciona una organización"); return; }
    if (orgMode === "new" && !newOrgName.trim()) { toast.error("Falta el nombre de la organización"); return; }

    startTransition(async () => {
      const res = await convertContactToClient({
        contactId: c.id,
        organizationId: orgMode === "existing" ? orgId : null,
        newOrganizationName: orgMode === "new" ? newOrgName.trim() : null,
        sendInvite,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Contacto convertido en cliente" + (sendInvite ? " — invitación enviada" : ""));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <UserCheck className="h-3.5 w-3.5" />
          Convertir en cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convertir contacto en cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {!c.email && (
            <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Este contacto no tiene email. Edita el contacto y añade uno antes de continuar.
            </p>
          )}

          <p className="text-muted-foreground">
            Se creará un usuario cliente con el email del contacto y se vinculará a una organización.
          </p>

          <div className="space-y-2">
            <Label className="text-xs">Organización</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrgMode("existing")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs ${orgMode === "existing" ? "border-primary bg-primary text-white" : "hover:border-primary/50"}`}
                disabled={pending}
              >
                Existente
              </button>
              <button
                type="button"
                onClick={() => setOrgMode("new")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs ${orgMode === "new" ? "border-primary bg-primary text-white" : "hover:border-primary/50"}`}
                disabled={pending}
              >
                Crear nueva
              </button>
            </div>

            {orgMode === "existing" ? (
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Selecciona…</option>
                {organizations.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
            ) : (
              <Input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Nombre de la nueva organización" disabled={pending} />
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} disabled={pending} className="h-4 w-4" />
            Enviar invitación por email al contacto
          </label>

          <p className="text-[11px] text-muted-foreground">
            El nuevo usuario tendrá rol <Badge variant="outline" className="text-[10px]">cliente</Badge> y verá el portal del cliente.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !c.email}>
            {pending ? "Procesando..." : "Convertir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
