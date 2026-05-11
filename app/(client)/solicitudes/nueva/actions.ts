"use server";

import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Crea un borrador con un ID generado en el cliente (lazy — solo cuando el usuario
 * hace clic en "Guardar borrador", "Enviar solicitud" o sube un archivo).
 */
export async function createDraftRequest(params: {
  id: string;
  organizationId: string;
  profileId: string;
  formSchemaId: string;
  serviceTypeId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireClient();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("certificate_requests").insert({
      id: params.id,
      organization_id: params.organizationId,
      created_by: params.profileId,
      form_schema_id: params.formSchemaId,
      service_type_id: params.serviceTypeId,
      form_data: {},
      status: "draft",
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function notifyAdminOnSubmit(_requestId: string) {
  await requireClient();
}
