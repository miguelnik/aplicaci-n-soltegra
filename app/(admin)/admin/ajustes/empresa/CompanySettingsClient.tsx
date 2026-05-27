"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateCompanySettings } from "@/lib/budgets/actions";
import type { CompanySettings } from "@/lib/budgets/types";

interface Props {
  initial: CompanySettings;
}

export function CompanySettingsClient({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [s, setS] = useState({
    legalName: initial.legal_name ?? "",
    tradeName: initial.trade_name ?? "",
    cif: initial.cif ?? "",
    addressLine1: initial.address_line1 ?? "",
    addressLine2: initial.address_line2 ?? "",
    postalCode: initial.postal_code ?? "",
    city: initial.city ?? "",
    province: initial.province ?? "",
    country: initial.country ?? "España",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    website: initial.website ?? "",
    iban: initial.iban ?? "",
    paymentTerms: initial.payment_terms ?? "",
    legalNotes: initial.legal_notes ?? "",
    defaultVat: String(initial.default_vat ?? 21),
    budgetPrefix: initial.budget_prefix ?? "PRES",
  });

  function set<K extends keyof typeof s>(k: K, v: (typeof s)[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    if (!s.legalName.trim()) { toast.error("La razón social es obligatoria"); return; }
    const vatNum = parseFloat(s.defaultVat);
    if (Number.isNaN(vatNum) || vatNum < 0 || vatNum > 100) { toast.error("IVA inválido"); return; }

    startTransition(async () => {
      const res = await updateCompanySettings({
        legalName: s.legalName,
        tradeName: s.tradeName || null,
        cif: s.cif || null,
        addressLine1: s.addressLine1 || null,
        addressLine2: s.addressLine2 || null,
        postalCode: s.postalCode || null,
        city: s.city || null,
        province: s.province || null,
        country: s.country || null,
        phone: s.phone || null,
        email: s.email || null,
        website: s.website || null,
        iban: s.iban || null,
        paymentTerms: s.paymentTerms || null,
        legalNotes: s.legalNotes || null,
        defaultVat: vatNum,
        budgetPrefix: s.budgetPrefix || "PRES",
      });
      if (!res.ok) { toast.error(res.error ?? "Error"); return; }
      toast.success("Datos guardados");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Identidad fiscal</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Razón social *</Label>
            <Input value={s.legalName} onChange={(e) => set("legalName", e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre comercial (si distinto)</Label>
            <Input value={s.tradeName} onChange={(e) => set("tradeName", e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CIF / NIF</Label>
            <Input value={s.cif} onChange={(e) => set("cif", e.target.value)} placeholder="B12345678" disabled={pending} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dirección fiscal</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Dirección</Label>
            <Input value={s.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} placeholder="C/ Real 12, 2ºA" disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Línea 2 (opcional)</Label>
            <Input value={s.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} disabled={pending} />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">CP</Label>
              <Input value={s.postalCode} onChange={(e) => set("postalCode", e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Ciudad</Label>
              <Input value={s.city} onChange={(e) => set("city", e.target.value)} placeholder="Granada" disabled={pending} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Provincia</Label>
              <Input value={s.province} onChange={(e) => set("province", e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">País</Label>
              <Input value={s.country} onChange={(e) => set("country", e.target.value)} disabled={pending} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contacto</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Teléfono</Label>
            <Input value={s.phone} onChange={(e) => set("phone", e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={s.email} onChange={(e) => set("email", e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Web</Label>
            <Input value={s.website} onChange={(e) => set("website", e.target.value)} placeholder="https://soltegra.es" disabled={pending} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Presupuestos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Prefijo de numeración</Label>
              <Input value={s.budgetPrefix} onChange={(e) => set("budgetPrefix", e.target.value)} placeholder="PRES" disabled={pending} />
              <p className="text-[10px] text-muted-foreground">Aparecerá como {s.budgetPrefix}-2026-0001</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IVA por defecto (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={s.defaultVat} onChange={(e) => set("defaultVat", e.target.value)} disabled={pending} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">IBAN / cuenta bancaria</Label>
            <Input value={s.iban} onChange={(e) => set("iban", e.target.value)} placeholder="ES12 3456 7890..." disabled={pending} />
            <p className="text-[10px] text-muted-foreground">Aparecerá en el pie del PDF si hay condiciones de pago.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Condiciones de pago (por defecto)</Label>
            <Textarea
              value={s.paymentTerms}
              onChange={(e) => set("paymentTerms", e.target.value)}
              rows={3}
              placeholder="Ej: 50% al aceptar el presupuesto y 50% a la entrega. Transferencia bancaria al IBAN indicado."
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas legales (por defecto)</Label>
            <Textarea
              value={s.legalNotes}
              onChange={(e) => set("legalNotes", e.target.value)}
              rows={2}
              placeholder="Ej: Este presupuesto no incluye gastos de desplazamiento fuera de la provincia de Granada."
              disabled={pending}
            />
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <Button onClick={save} disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
