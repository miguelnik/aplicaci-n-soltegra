"use server";

import { requireAdmin } from "@/lib/auth";
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
  const admin = createSupabaseAdminClient();

  const { data: req, error } = await admin
    .rpc("admin_update_request_status", {
      p_request_id: requestId,
      p_new_status: newStatus,
      p_estimated_delivery_date: deliveryDate || null,
      p_internal_notes: notes || null,
    })
    .single();

  if (error) throw new Error(error.message);

  const reqData = req as {
    created_by: string;
    reference_code: string;
    property_address: string;
    estimated_delivery_date: string | null;
  };

  const { data: authUser } = await admin.auth.admin.getUserById(reqData.created_by);
  const email = authUser?.user?.email;

  if (email) {
    try {
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
    } catch {
      // Email failure should not block status update
    }
  }
}
