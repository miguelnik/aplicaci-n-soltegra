"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createCrmContact } from "@/lib/crm/actions";

interface Props {
  organizations: { id: string; name: string }[];
  workers: { id: string; full_name: string | null }[];
}

export function NewContactClient({ organizations, workers }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [organizationId, setOrgId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!fullName.trim()) { toast.error("Falta el nombre"); return; }
    startTransition(async () => {
      const res = await createCrmContact({
        fullName,
        email: email || null,
        phone: phone || null,
        position: position || null,
        organizationId: organizationId || null,
        companyName: companyName || null,
        ownerId: ownerId || undefined,
        notes: notes || null,
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Contacto creado");
      router.push(`/admin/crm/contactos/${res.id}`);
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle className="text-base">Datos del contacto</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Nombre completo *</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre y apellidos" disabled={pending} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Teléfono</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34..." disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cargo</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Ej: Director técnico" disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Empresa (texto libre)</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Si no es cliente formal todavía" disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">O vincular con cliente existente</Label>
            <select value={organizationId} onChange={(e) => setOrgId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Ninguno —</option>
              {organizations.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Comercial responsable</Label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={pending} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">— Yo —</option>
              {workers.map((w) => (<option key={w.id} value={w.id}>{w.full_name ?? w.id.slice(0,8)}</option>))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={pending} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={submit} disabled={pending || !fullName.trim()}>
            {pending ? "Creando..." : "Crear contacto"}
          </Button>
          <Button variant="ghost" onClick={() => router.back()} disabled={pending}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
