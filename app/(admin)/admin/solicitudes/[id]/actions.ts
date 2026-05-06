"use server";

import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEstadoActualizado, sendCertificadoListo } from "@/lib/email/send";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export async function updateStatus(
  requestId: string,
  newStatus: string,
  deliveryDate: string,
  notes: string,
) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  // deliveryDate viene como "YYYY-MM-DD" del input date, o "" si vacío
  const { data: req, error } = await supabase
    .rpc("admin_update_request_status", {
      p_request_id: requestId,
      p_new_status: newStatus,
      p_estimated_delivery_date: deliveryDate || null,
      p_internal_notes: notes || null,
    })
    .single();

  if (error) {
    console.error("RPC admin_update_request_status error:", error);
    throw new Error(error.message);
  }
  if (!req) throw new Error("No se pudo actualizar la solicitud");

  const reqData = req as {
    created_by: string;
    reference_code: string;
    property_address: string;
  };

  try {
    const adminClient = createSupabaseAdminClient();
    const { data: authUser } = await adminClient.auth.admin.getUserById(reqData.created_by);
    const email = authUser?.user?.email;

    if (email) {
      if (newStatus === "delivered") {
        await sendCertificadoListo({
          toEmail: email,
          referenceCode: reqData.reference_code ?? requestId,
          propertyAddress: reqData.property_address ?? "",
          requestId,
        });
      } else {
        await sendEstadoActualizado({
          toEmail: email,
          referenceCode: reqData.reference_code ?? requestId,
          propertyAddress: reqData.property_address ?? "",
          newStatus,
          estimatedDelivery: deliveryDate
            ? format(new Date(deliveryDate), "d 'de' MMMM 'de' yyyy", { locale: es })
            : undefined,
          requestId,
        });
      }
    }
  } catch {
    // Email failure should not block status update
  }
}
