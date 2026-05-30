"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { updateCompanySettings } from "@/lib/budgets/actions";
import { updateAiSettings, testAiConnection } from "@/lib/ai/actions";
import { AI_MODELS } from "@/lib/ai/types";
import type { CompanySettings } from "@/lib/budgets/types";

interface Props {
  initial: CompanySettings;
  aiConfig: { hasApiKey: boolean; model: string };
}

export function CompanySettingsClient({ initial, aiConfig }: Props) {
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

  // ── Estado IA ────────────────────────────────────────────────────────────
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState(aiConfig.model);
  const [hasExistingKey, setHasExistingKey] = useState(aiConfig.hasApiKey);
  const [aiPending, startAiTransition] = useTransition();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

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

      {/* ── Inteligencia Artificial ──────────────────────────────────────── */}
      <Card className="lg:col-span-2 border-accent/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-accent" />
            Inteligencia Artificial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configura la conexión con OpenAI para habilitar el asistente comercial y
            la inteligencia de cliente en el CRM. La clave API se almacena encriptada
            y nunca se expone al navegador.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Clave API de OpenAI</Label>
              <Input
                type="password"
                value={aiApiKey}
                onChange={(e) => {
                  setAiApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder={hasExistingKey ? "sk-...•••• (ya configurada)" : "sk-proj-..."}
                disabled={aiPending}
              />
              {hasExistingKey && !aiApiKey && (
                <p className="text-[10px] text-green-600">
                  ✓ Clave configurada. Deja vacío para mantenerla.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modelo</Label>
              <Select value={aiModel} onValueChange={setAiModel} disabled={aiPending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                testResult.ok
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              {testResult.message}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={aiPending}
              onClick={() => {
                startAiTransition(async () => {
                  // Si hay key nueva, guardarla primero
                  if (aiApiKey.trim()) {
                    const saveRes = await updateAiSettings({
                      apiKey: aiApiKey,
                      model: aiModel,
                    });
                    if (!saveRes.ok) {
                      setTestResult({ ok: false, message: saveRes.error ?? "Error" });
                      return;
                    }
                    setHasExistingKey(true);
                    setAiApiKey("");
                  }
                  // Probar conexión
                  const res = await testAiConnection();
                  setTestResult({
                    ok: res.ok,
                    message: res.ok
                      ? `Conexión exitosa con modelo ${res.model}`
                      : res.error ?? "Error desconocido",
                  });
                });
              }}
            >
              {aiPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Probar conexión
            </Button>
            <Button
              size="sm"
              disabled={aiPending || (!aiApiKey.trim() && aiModel === aiConfig.model)}
              onClick={() => {
                startAiTransition(async () => {
                  const res = await updateAiSettings({
                    apiKey: aiApiKey.trim() || undefined,
                    model: aiModel,
                  });
                  if (!res.ok) {
                    toast.error(res.error ?? "Error");
                    return;
                  }
                  toast.success("Configuración de IA guardada");
                  if (aiApiKey.trim()) {
                    setHasExistingKey(true);
                    setAiApiKey("");
                  }
                  router.refresh();
                });
              }}
            >
              <Save className="h-4 w-4" />
              {aiPending ? "Guardando..." : "Guardar IA"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
