"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireClient } from "@/lib/auth";
import { sendNuevaSolicitudAdmin } from "@/lib/email/send";

export async function notifyAdminOnSubmit(requestId: string) {
  await requireClient();
  const supabase = await createSupabaseServerClient();

  const { data: req } = await supabase
    .from("certificate_requests")
    .select("reference_code, property_address, created_by, organization_id")
    .eq("id", requestId)
    .single();

  if (!req) return;

  const adminClient = createSupabaseAdminClient();
  const { data: creator } = await adminClient.auth.admin.getUserById(req.created_by);
  const clientName = creator.user?.user_metadata?.full_name ?? creator.user?.email ?? "Cliente";

  await sendNuevaSolicitudAdmin({
    referenceCode: req.reference_code ?? requestId,
    propertyAddress: req.property_address ?? "Sin dirección",
    clientName,
    requestId,
  });
}
