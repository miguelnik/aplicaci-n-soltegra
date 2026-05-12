// ============================================================================
// Portal del cliente — Configuración de módulos por tipo de servicio
// Ruta: /admin/servicios/[id]/portal
//
// El admin decide qué secciones ve el cliente en el detalle de cada expediente.
// Los cambios se guardan como JSONB en service_types.module_config.
// Si se resetea a los valores por defecto, module_config queda a NULL y el
// código usa el fallback definido en lib/modules/defaults.ts.
// ============================================================================

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getServiceById } from "@/lib/services";
import { MODULE_CATALOG, GROUP_LABELS, type ModuleMeta } from "@/lib/modules/catalog";
import { getEffectiveModules } from "@/lib/modules/defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  Lock,
  Users,
  Info,
  LayoutDashboard,
} from "lucide-react";
import type { ModuleConfig, ModuleVisibility } from "@/lib/modules/types";

// ──────────────────────────────────────────────────────────────────────────────
// Server Actions
// ──────────────────────────────────────────────────────────────────────────────

async function saveModuleConfig(serviceId: string, formData: FormData) {
  "use server";
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  // El formulario envía para cada módulo del catálogo:
  //   key_N        → clave del módulo (hidden, siempre presente)
  //   label_N      → etiqueta personalizada
  //   visible_to_N → "client" | "admin" | "both"
  //   order_N      → número de orden
  //   active_N     → "1" si el checkbox está marcado (ausente si no)
  const n = MODULE_CATALOG.length;
  const modules: ModuleConfig[] = [];

  for (let i = 0; i < n; i++) {
    const key = formData.get(`key_${i}`) as string | null;
    if (!key) continue;

    const meta = MODULE_CATALOG.find((m) => m.key === key);
    const defaultLabel = meta?.defaultLabel ?? key;

    modules.push({
      key: key as ModuleConfig["key"],
      label: ((formData.get(`label_${i}`) as string) || "").trim() || defaultLabel,
      visible_to: ((formData.get(`visible_to_${i}`) as string) || "both") as ModuleVisibility,
      order: parseInt((formData.get(`order_${i}`) as string) || String(i), 10),
      is_active: formData.get(`active_${i}`) === "1",
    });
  }

  // Ordenar por el campo 'order' para que la BD quede limpia
  modules.sort((a, b) => a.order - b.order);

  const { error } = await admin
    .from("service_types")
    .update({ module_config: modules })
    .eq("id", serviceId);

  if (error) {
    redirect(
      `/admin/servicios/${serviceId}/portal?error=` +
        encodeURIComponent("Error al guardar: " + error.message),
    );
  }
  redirect(`/admin/servicios/${serviceId}/portal?saved=1`);
}

async function resetToDefault(serviceId: string) {
  "use server";
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  // NULL → usa el fallback de código (getEffectiveModules)
  const { error } = await admin
    .from("service_types")
    .update({ module_config: null })
    .eq("id", serviceId);

  if (error) {
    redirect(
      `/admin/servicios/${serviceId}/portal?error=` +
        encodeURIComponent("Error al resetear: " + error.message),
    );
  }
  redirect(`/admin/servicios/${serviceId}/portal?reset=1`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Utilidades de UI
// ──────────────────────────────────────────────────────────────────────────────

function VisibilityIcon({ v }: { v: ModuleVisibility }) {
  if (v === "client") return <Eye className="h-3.5 w-3.5 text-blue-500" />;
  if (v === "admin") return <Lock className="h-3.5 w-3.5 text-orange-500" />;
  return <Users className="h-3.5 w-3.5 text-green-600" />;
}

const VISIBILITY_OPTIONS: { value: ModuleVisibility; label: string }[] = [
  { value: "both", label: "Cliente y admin" },
  { value: "client", label: "Solo cliente" },
  { value: "admin", label: "Solo admin" },
];

// ──────────────────────────────────────────────────────────────────────────────
// Página
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; reset?: string; error?: string }>;
}

export default async function PortalConfigPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { saved, reset, error } = await searchParams;

  const service = await getServiceById(id);
  if (!service) notFound();

  // Configuración efectiva actual (BD o fallback)
  const effectiveModules = getEffectiveModules(service.slug, service.module_config);
  const isUsingDefault = !service.module_config || service.module_config.length === 0;

  // Crear mapa key → configuración efectiva para prellenar el formulario
  const configByKey = new Map<string, ModuleConfig>(
    effectiveModules.map((m) => [m.key, m]),
  );

  const saveBound = saveModuleConfig.bind(null, id);
  const resetBound = resetToDefault.bind(null, id);

  // Agrupar módulos del catálogo por grupo
  const groups = Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>;

  return (
    <div className="space-y-6">
      {/* ── Cabecera ── */}
      <div>
        <Link
          href={`/admin/servicios/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a {service.name}
        </Link>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Portal del cliente</h1>
          </div>
          <Badge variant={isUsingDefault ? "secondary" : "default"}>
            {isUsingDefault ? "Configuración por defecto" : "Configuración personalizada"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Configura qué secciones ve el cliente en el detalle de cada expediente de{" "}
          <strong>{service.name}</strong>. Los cambios afectan a todos los expedientes
          de este tipo de servicio, incluidos los ya creados.
        </p>
      </div>

      {/* ── Feedback ── */}
      {saved && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          Configuración guardada correctamente.
        </div>
      )}
      {reset && (
        <div className="flex items-center gap-2 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <RotateCcw className="h-4 w-4" />
          Configuración restablecida a los valores por defecto.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Leyenda de visibilidad ── */}
      <div className="flex flex-wrap gap-4 rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium">Visibilidad:</span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-green-600" /> Cliente y admin
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5 text-blue-500" /> Solo cliente
        </span>
        <span className="flex items-center gap-1">
          <Lock className="h-3.5 w-3.5 text-orange-500" /> Solo admin
        </span>
      </div>

      {/* ── Formulario principal ── */}
      <form action={saveBound} className="space-y-6">
        {groups.map((group) => {
          const groupModules = MODULE_CATALOG.filter((m) => m.group === group);

          return (
            <Card key={group}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{GROUP_LABELS[group]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {/* ── Cabecera de tabla ── */}
                <div className="mb-2 hidden grid-cols-[2rem_1fr_9rem_6rem_5rem] gap-3 text-xs font-medium text-muted-foreground sm:grid">
                  <span className="text-center">Activo</span>
                  <span>Nombre en portal</span>
                  <span>Visibilidad</span>
                  <span className="text-center">Orden</span>
                  <span>Estado</span>
                </div>

                {groupModules.map((meta: ModuleMeta, groupIdx: number) => {
                  // Índice global (para los campos del formulario)
                  const globalIdx = MODULE_CATALOG.findIndex(
                    (m) => m.key === meta.key,
                  );
                  const current = configByKey.get(meta.key);
                  const isActive = current?.is_active ?? false;
                  const visibleTo = current?.visible_to ?? meta.defaultVisibility;
                  const label = current?.label ?? meta.defaultLabel;
                  const order = current?.order ?? groupIdx;

                  return (
                    <div
                      key={meta.key}
                      className={`rounded-md border p-3 transition-colors ${
                        isActive ? "bg-background" : "bg-muted/30 opacity-60"
                      }`}
                    >
                      {/* Campo hidden para la clave */}
                      <input
                        type="hidden"
                        name={`key_${globalIdx}`}
                        value={meta.key}
                      />

                      {/* Layout en grid para pantallas grandes */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2rem_1fr_9rem_6rem_5rem] sm:items-center">
                        {/* Checkbox activo */}
                        <div className="flex items-center gap-2 sm:justify-center">
                          <input
                            type="checkbox"
                            id={`active_${globalIdx}`}
                            name={`active_${globalIdx}`}
                            value="1"
                            defaultChecked={isActive}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <Label
                            htmlFor={`active_${globalIdx}`}
                            className="text-sm sm:hidden"
                          >
                            Activo
                          </Label>
                        </div>

                        {/* Nombre personalizable */}
                        <div className="space-y-0.5">
                          <Input
                            name={`label_${globalIdx}`}
                            defaultValue={label}
                            placeholder={meta.defaultLabel}
                            className="h-8 text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            {meta.description}
                          </p>
                        </div>

                        {/* Visibilidad */}
                        <div className="flex items-center gap-1.5">
                          <VisibilityIcon v={visibleTo} />
                          <select
                            name={`visible_to_${globalIdx}`}
                            defaultValue={visibleTo}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          >
                            {VISIBILITY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Orden numérico */}
                        <input
                          type="number"
                          name={`order_${globalIdx}`}
                          defaultValue={order}
                          min={0}
                          max={99}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-center text-sm"
                        />

                        {/* Badge de estado del módulo */}
                        <div className="flex items-center">
                          {meta.implemented ? (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-xs text-green-700"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Disponible
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <Info className="mr-1 h-3 w-3" />
                              Próximamente
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        {/* ── Acciones ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Los módulos con estado &quot;Próximamente&quot; no se mostrarán al cliente aunque
            estén activos. Solo el admin los verá como marcadores de posición.
          </p>
          <div className="flex gap-2">
            <SubmitButton size="sm" pendingText="Guardando...">
              Guardar configuración
            </SubmitButton>
          </div>
        </div>
      </form>

      {/* ── Zona de reset ── */}
      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Restablecer por defecto
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Elimina la configuración personalizada y vuelve al comportamiento predeterminado
            para este tipo de servicio. Los expedientes existentes no se ven afectados
            en sus datos, solo en su presentación.
          </p>
          <form action={resetBound}>
            <SubmitButton
              variant="outline"
              size="sm"
              pendingText="Restableciendo..."
              className="shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
