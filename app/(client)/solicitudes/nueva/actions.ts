"use server";

import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendNuevaSolicitudAdmin } from "@/lib/email/send";

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

/**
 * Notifica a los admins de Soltegra que acaba de llegar una nueva solicitud.
 * Se llama tras el RPC submit_request (fire-and-forget desde el cliente).
 */
export async function notifyAdminOnSubmit(requestId: string): Promise<void> {
  try {
    await requireClient();
    const supabase = await createSupabaseServerClient();

    // Obtener datos de la solicitud recién enviada
    const { data: req } = await supabase
      .from("certificate_requests")
      .select("reference_code, property_address, created_by")
      .eq("id", requestId)
      .single();

    if (!req) return;

    // Nombre del cliente (desde profiles)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", req.created_by)
      .single();

    await sendNuevaSolicitudAdmin({
      referenceCode: req.reference_code ?? requestId,
      propertyAddress: req.property_address ?? "Sin dirección",
      clientName: profile?.full_name ?? "Cliente",
      requestId,
    });
  } catch (err) {
    // No bloquea el flujo del cliente si el email falla
    console.error("notifyAdminOnSubmit error:", err);
  }
}
