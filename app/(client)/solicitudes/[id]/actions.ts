"use server";

import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteRequestCompletely } from "@/lib/delete-request";

/** Estados que el cliente puede borrar */
const DELETABLE_STATUSES = ["draft", "submitted", "cancelled"];

export async function deleteRequest(requestId: string) {
  const profile = await requireClient();
  const supabase = await createSupabaseServerClient();

  // Verificar que la solicitud pertenece al cliente y tiene un estado borrable
  const { data: req } = await supabase
    .from("certificate_requests")
    .select("id, status, organization_id, certificate_pdf_path")
    .eq("id", requestId)
    .eq("organization_id", profile.organization_id!)
    .single();

  if (!req) throw new Error("Solicitud no encontrada");
  if (!DELETABLE_STATUSES.includes(req.status)) {
    throw new Error("Esta solicitud no se puede eliminar en su estado actual");
  }

  await deleteRequestCompletely(requestId, req.certificate_pdf_path ?? null);
  redirect("/solicitudes");
}

/** @deprecated usar deleteRequest */
export const deleteDraft = deleteRequest;

/** @deprecated usar deleteRequest */
export const deleteDraft = deleteRequest;
