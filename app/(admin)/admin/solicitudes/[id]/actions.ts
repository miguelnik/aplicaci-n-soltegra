"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendCertificadoListo } from "@/lib/email/send";
import { deleteRequestCompletely } from "@/lib/delete-request";

/**
 * Server action de fallback para cambio de estado.
 * El componente StatusChanger usa la API route /api/admin/update-status,
 * que es más robusta al devolver JSON con errores detallados.
 * Este action se mantiene como respaldo.
 */
export async function updateStatus(
  requestId: string,
  newStatus: string,
  deliveryDate: string,
  notes: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();

    const supabase = await createSupabaseServerClient();

    const { data: req, error } = await supabase
      .rpc("admin_update_request_status", {
        p_request_id: requestId,
        p_new_status: newStatus,
        p_estimated_delivery_date: deliveryDate || null,
        p_internal_notes: notes || null,
      })
      .single();

    if (error) {
      return { ok: false, error: `RPC: ${error.message} (code: ${error.code})` };
    }
    if (!req) {
      return { ok: false, error: "No se devolvieron datos de la solicitud" };
    }

    const reqData = req as {
      created_by: string;
      reference_code: string;
      property_address: string;
    };

    // Solo notificar al cliente cuando se marca como entregado
    if (newStatus === "delivered") {
      try {
        const adminClient = createSupabaseAdminClient();
        const { data: authUser } = await adminClient.auth.admin.getUserById(reqData.created_by);
        const email = authUser?.user?.email;
        if (email) {
          await sendCertificadoListo({
            toEmail: email,
            referenceCode: reqData.reference_code ?? requestId,
            propertyAddress: reqData.property_address ?? "",
            requestId,
          });
        }
      } catch {
        // El fallo del email no bloquea el cambio de estado
      }
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Elimina completamente una solicitud (admin/superadmin).
 * Limpia Storage y borra la fila; el CASCADE elimina todos los datos hijos.
 */
export async function deleteAdminRequest(requestId: string): Promise<void> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: req } = await admin
    .from("certificate_requests")
    .select("id, certificate_pdf_path")
    .eq("id", requestId)
    .single();

  if (!req) throw new Error("Solicitud no encontrada");

  await deleteRequestCompletely(requestId, req.certificate_pdf_path ?? null);
  redirect("/admin/solicitudes");
}
