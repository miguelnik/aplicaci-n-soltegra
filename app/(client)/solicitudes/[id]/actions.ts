"use server";

import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Estados que el cliente puede borrar */
const DELETABLE_STATUSES = ["draft", "submitted", "cancelled"];

export async function deleteRequest(requestId: string) {
  const profile = await requireClient();
  const supabase = await createSupabaseServerClient();

  // Verificar que la solicitud pertenece al cliente y tiene un estado borrable
  const { data: req } = await supabase
    .from("certificate_requests")
    .select("id, status, organization_id")
    .eq("id", requestId)
    .eq("organization_id", profile.organization_id!)
    .single();

  if (!req) throw new Error("Solicitud no encontrada");
  if (!DELETABLE_STATUSES.includes(req.status)) {
    throw new Error("Esta solicitud no se puede eliminar en su estado actual");
  }

  const admin = createSupabaseAdminClient();

  // Obtener rutas de archivos antes de borrar las filas
  const { data: files } = await admin
    .from("request_files")
    .select("storage_path")
    .eq("request_id", requestId);

  // Borrar archivos del bucket de Storage
  if (files && files.length > 0) {
    const paths = files.map((f: { storage_path: string }) => f.storage_path);
    await admin.storage.from("request-uploads").remove(paths);
  }

  // Borrar mensajes asociados
  await admin.from("request_messages").delete().eq("request_id", requestId);
  // Borrar registros de archivos
  await admin.from("request_files").delete().eq("request_id", requestId);
  // Borrar la solicitud
  await admin.from("certificate_requests").delete().eq("id", requestId);

  redirect("/solicitudes");
}

/** @deprecated usar deleteRequest */
export const deleteDraft = deleteRequest;
