"use server";

import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function deleteDraft(requestId: string) {
  const profile = await requireClient();
  const supabase = await createSupabaseServerClient();

  const { data: req } = await supabase
    .from("certificate_requests")
    .select("id, status, organization_id")
    .eq("id", requestId)
    .eq("organization_id", profile.organization_id!)
    .single();

  if (!req) throw new Error("Solicitud no encontrada");
  if (req.status !== "draft") throw new Error("Solo se pueden eliminar borradores");

  const admin = createSupabaseAdminClient();

  await admin.from("request_files").delete().eq("request_id", requestId);
  await admin.from("certificate_requests").delete().eq("id", requestId);

  redirect("/dashboard");
}
