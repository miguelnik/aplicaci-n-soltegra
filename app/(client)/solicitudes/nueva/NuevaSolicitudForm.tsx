"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormRenderer } from "@/components/forms/FormRenderer";
import type { FormSchema, FormData } from "@/lib/form-schema/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createDraftRequest, notifyAdminOnSubmit } from "./actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  schema: FormSchema;
  schemaId: string;
  serviceId: string;
  organizationId: string;
  profileId: string;
}

export function NuevaSolicitudForm({
  schema,
  schemaId,
  serviceId,
  organizationId,
  profileId,
}: Props) {
  const [deadline, setDeadline] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [savingDialog, setSavingDialog] = useState(false);

  // ID generado una sola vez en el cliente; el borrador se crea en DB solo si se guarda
  const requestId = useRef<string>(crypto.randomUUID());
  const draftCreated = useRef(false);
  // Datos más recientes del formulario (actualizados por onFieldChange)
  const latestData = useRef<FormData>({});
  // URL de destino capturada cuando se intercepta la navegación
  const pendingUrl = useRef<string>("");
  // Referencia al pushState original para restaurarlo
  const originalPushState = useRef<typeof window.history.pushState | null>(null);

  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // ── Lazy: crea el registro en DB si aún no existe ────────────────────────
  const ensureDraftCreated = useCallback(async (): Promise<boolean> => {
    if (draftCreated.current) return true;
    const result = await createDraftRequest({
      id: requestId.current,
      organizationId,
      profileId,
      formSchemaId: schemaId,
      serviceTypeId: serviceId,
    });
    if (!result.ok) {
      toast.error(`Error al preparar la solicitud: ${result.error}`);
      return false;
    }
    draftCreated.current = true;
    return true;
  }, [organizationId, profileId, schemaId, serviceId]);

  // ── Guardar datos en la fila existente ───────────────────────────────────
  async function persistFormData(data: FormData) {
    const titleKey = schema.titleFieldKey ?? "direccion";
    const titleValue = data[titleKey];
    const propertyAddress =
      typeof titleValue === "string" || typeof titleValue === "number"
        ? String(titleValue)
        : null;

    return supabase
      .from("certificate_requests")
      .update({
        form_data: data,
        property_address: propertyAddress,
        client_deadline: deadline || null,
      })
      .eq("id", requestId.current);
  }

  // ── Guardar borrador ──────────────────────────────────────────────────────
  async function handleSaveDraft(data: FormData) {
    const ok = await ensureDraftCreated();
    if (!ok) return;
    const { error } = await persistFormData(data);
    if (error) { toast.error("Error al guardar el borrador"); return; }
    setIsDirty(false);
    toast.success("Borrador guardado");
  }

  // ── Enviar solicitud ──────────────────────────────────────────────────────
  async function handleSubmit(data: FormData) {
    const ok = await ensureDraftCreated();
    if (!ok) return;
    const { error: updateError } = await persistFormData(data);
    if (updateError) { toast.error("Error al guardar los datos"); return; }

    const { error } = await supabase.rpc("submit_request", {
      p_request_id: requestId.current,
    });
    if (error) { toast.error("Error al enviar la solicitud"); return; }

    notifyAdminOnSubmit(requestId.current).catch(console.error);
    setIsDirty(false);
    setSubmitted(true);
    // Restaurar pushState ANTES de navegar — si no, el interceptor lo bloquearía
    // porque los cambios de estado React aún no se han propagado al effect
    if (originalPushState.current) {
      window.history.pushState = originalPushState.current;
      originalPushState.current = null;
    }
    toast.success("Solicitud enviada correctamente");
    router.push("/dashboard");
  }

  // ── Guardar desde el dialog y navegar ────────────────────────────────────
  async function handleSaveAndLeave() {
    setSavingDialog(true);
    try {
      const ok = await ensureDraftCreated();
      if (!ok) return;
      const { error } = await persistFormData(latestData.current);
      if (error) { toast.error("Error al guardar el borrador"); return; }
      toast.success("Borrador guardado");
      setIsDirty(false);
      navigatePending();
    } finally {
      setSavingDialog(false);
    }
  }

  // ── Salir sin guardar ────────────────────────────────────────────────────
  function handleLeaveWithoutSaving() {
    setIsDirty(false);
    setShowLeaveDialog(false);
    navigatePending();
  }

  // ── Ejecutar la navegación pendiente ─────────────────────────────────────
  function navigatePending() {
    setShowLeaveDialog(false);
    if (originalPushState.current) {
      window.history.pushState = originalPushState.current;
      originalPushState.current = null;
    }
    if (pendingUrl.current) {
      router.push(pendingUrl.current);
    }
  }

  // ── Guards: beforeunload + pushState interceptor ─────────────────────────
  useEffect(() => {
    if (!isDirty || submitted) {
      // Si ya no hay cambios, restaurar pushState si estaba parcheado
      if (originalPushState.current) {
        window.history.pushState = originalPushState.current;
        originalPushState.current = null;
      }
      return;
    }

    // Cierre de pestaña / recarga
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Navegación SPA (Next.js usa history.pushState)
    const original = window.history.pushState.bind(window.history);
    originalPushState.current = original;

    window.history.pushState = function (state, title, url) {
      // Excluir cambios de hash o la misma ruta (p.ej. scroll)
      const target = String(url ?? "");
      if (target && target !== window.location.pathname) {
        pendingUrl.current = target;
        setShowLeaveDialog(true);
        return; // bloquea la navegación
      }
      original(state, title, url);
    };

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (originalPushState.current) {
        window.history.pushState = originalPushState.current;
        originalPushState.current = null;
      }
    };
  }, [isDirty, submitted]);

  // ── Callback que recibe cambios del formulario ───────────────────────────
  const handleFieldChange = useCallback((data: FormData) => {
    latestData.current = data;
    setIsDirty(true);
  }, []);

  return (
    <>
      {/* Dialog: ¿Salir sin guardar? */}
      <Dialog open={showLeaveDialog} onOpenChange={(open: boolean) => !open && setShowLeaveDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              ¿Salir sin guardar?
            </DialogTitle>
            <DialogDescription>
              Tienes datos sin guardar. Si sales ahora perderás la información introducida.
              Puedes guardar un borrador para continuar más tarde.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              onClick={() => setShowLeaveDialog(false)}
              disabled={savingDialog}
            >
              Seguir editando
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveAndLeave}
              disabled={savingDialog}
            >
              {savingDialog && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar borrador y salir
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeaveWithoutSaving}
              disabled={savingDialog}
            >
              Salir sin guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Fecha máxima de entrega */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <Label htmlFor="client_deadline" className="text-sm font-medium">
            Fecha máxima de entrega{" "}
            <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Si necesitas el certificado antes de una fecha concreta, indícala aquí.
          </p>
          <Input
            id="client_deadline"
            type="date"
            value={deadline}
            onChange={(e) => { setDeadline(e.target.value); setIsDirty(true); }}
            className="max-w-[200px]"
          />
        </div>

        <FormRenderer
          schema={schema}
          requestId={requestId.current}
          organizationId={organizationId}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
          onFieldChange={handleFieldChange}
          onBeforeFileUpload={ensureDraftCreated}
          submitLabel="Enviar solicitud"
        />
      </div>
    </>
  );
}
