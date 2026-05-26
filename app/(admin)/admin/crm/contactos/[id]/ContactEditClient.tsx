"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { updateCrmContact, deleteCrmContact } from "@/lib/crm/actions";

interface Props {
  contact: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    position: string | null;
    organization_id: string | null;
    company_name: string | null;
    notes: string | null;
    owner_id: string | null;
  };
  organizations: { id: string; name: string }[];
  workers: { id: string; full_name: string | null }[];
}

export function ContactEditClient({ contact, organizations, workers }: Props) {
  const router = useRouter();
  const c = contact;
  const [fullName, setFullName] = useState(c.full_name);
  const [email, setEmail] = useState(c.email ?? "");
  const [phone, setPhone] = useState(c.phone ?? "");
  const [position, setPosition] = useState(c.position ?? "");
  const [organizationId, setOrgId] = useState(c.organization_id ?? "");
  const [companyName, setCompanyName] = useState(c.company_name ?? "");
  const [ownerId, setOwnerId] = useState(c.owner_id ?? "");
  const [notes, setNotes] = useState(c.notes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
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
      router.refresh();
    });
  }

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
      <CardHeader className="pb-3"><CardTitle className="text-sm">Editar</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <details>
          <summary className="cursor-pointer text-xs font-medium">Datos del contacto</summary>
          <div className="space-y-2 pt-2">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre" className="h-8 text-sm" disabled={pending} />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="h-8 text-sm" disabled={pending} />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" type="tel" className="h-8 text-sm" disabled={pending} />
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Cargo" className="h-8 text-sm" disabled={pending} />
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Empresa (libre)" className="h-8 text-sm" disabled={pending} />
            <Label className="text-[11px]">Cliente vinculado</Label>
            <select value={organizationId} onChange={(e) => setOrgId(e.target.value)} disabled={pending} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Ninguno —</option>
              {organizations.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
            </select>
            <Label className="text-[11px]">Comercial</Label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={pending} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Sin asignar —</option>
              {workers.map((w) => (<option key={w.id} value={w.id}>{w.full_name ?? w.id.slice(0,8)}</option>))}
            </select>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" rows={2} className="text-sm" disabled={pending} />
          </div>
        </details>

        <Button size="sm" onClick={save} disabled={pending} className="w-full">
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={pending} className="w-full text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </Button>
      </CardContent>
    </Card>
  );
}
