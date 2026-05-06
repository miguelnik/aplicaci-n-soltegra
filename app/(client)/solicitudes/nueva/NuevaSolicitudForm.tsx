"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormRenderer } from "@/components/forms/FormRenderer";
import type { FormSchema, FormData } from "@/lib/form-schema/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { notifyAdminOnSubmit } from "./actions";

interface Props {
  schema: FormSchema;
  requestId: string;
  organizationId: string;
}

export function NuevaSolicitudForm({ schema, requestId, organizationId }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function updateFormData(data: FormData) {
    return supabase
      .from("certificate_requests")
      .update({
        form_data: data,
        property_address: (data.direccion as string) || null,
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

    // Notificar a los admins (no bloquea aunque falle)
    notifyAdminOnSubmit(requestId).catch(console.error);

    toast.success("Solicitud enviada correctamente");
    router.push("/dashboard");
  }

  return (
    <FormRenderer
      schema={schema}
      requestId={requestId}
      organizationId={organizationId}
      onSaveDraft={handleSaveDraft}
      onSubmit={handleSubmit}
      submitLabel="Enviar solicitud"
    />
  );
}
