"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormRenderer } from "@/components/forms/FormRenderer";
import type { FormSchema, FormData } from "@/lib/form-schema/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { notifyAdminOnSubmit } from "./actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Props {
  schema: FormSchema;
  requestId: string;
  organizationId: string;
}

export function NuevaSolicitudForm({ schema, requestId, organizationId }: Props) {
  const [deadline, setDeadline] = useState("");
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function updateFormData(data: FormData) {
    return supabase
      .from("certificate_requests")
      .update({
        form_data: data,
        property_address: (data.direccion as string) || null,
        client_deadline: deadline || null,
      })
      .eq("id", requestId);
  }

  async function handleSaveDraft(data: FormData) {
    const { error } = await updateFormData(data);
    if (error) { toast.error("Error al guardar el borrador"); return; }
    toast.success("Borrador guardado");
  }

  async function handleSubmit(data: FormData) {
    const { error: updateError } = await updateFormData(data);
    if (updateError) { toast.error("Error al guardar los datos"); return; }

    const { error } = await supabase.rpc("submit_request", { p_request_id: requestId });
    if (error) { toast.error("Error al enviar la solicitud"); return; }

    notifyAdminOnSubmit(requestId).catch(console.error);

    toast.success("Solicitud enviada correctamente");
    router.push("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4">
        <Label htmlFor="client_deadline" className="text-sm font-medium">
          Fecha máxima de entrega <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Si necesitas el certificado antes de una fecha concreta, indícala aquí.
        </p>
        <Input
          id="client_deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="max-w-[200px]"
        />
      </div>
      <FormRenderer
        schema={schema}
        requestId={requestId}
        organizationId={organizationId}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        submitLabel="Enviar solicitud"
      />
    </div>
  );
}
