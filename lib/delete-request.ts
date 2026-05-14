/**
 * Elimina todos los archivos de Storage asociados a una solicitud
 * y luego borra la fila de certificate_requests (el CASCADE de FK
 * limpia automáticamente todas las tablas hijas en la BD).
 *
 * Se usa tanto desde el cliente (deleteRequest) como desde el admin.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Borra todos los ficheros de todos los buckets relacionados con la solicitud.
 * No lanza error si algún fichero ya no existe en Storage.
 */
export async function purgeRequestStorage(
  requestId: string,
  certificatePdfPath: string | null,
): Promise<void> {
  const admin = createSupabaseAdminClient();

  // Recoger paths de todos los buckets en paralelo
  const [
    { data: requestFiles },
    { data: expeditionDocs },
    { data: meetingMinutes },
    { data: photos },
    { data: attachments },
  ] = await Promise.all([
    admin.from("request_files").select("storage_path").eq("request_id", requestId),
    admin.from("expedition_documents").select("storage_path").eq("request_id", requestId),
    admin.from("expedition_meeting_minutes").select("storage_path").eq("request_id", requestId),
    admin.from("expedition_photos").select("storage_path").eq("request_id", requestId),
    admin.from("expedition_attachments").select("storage_path").eq("request_id", requestId),
  ]);

  // Limpiar cada bucket (ignoramos errores individuales — si el fichero ya no existe, no pasa nada)
  const cleanups: Promise<unknown>[] = [];

  const uploadPaths = (requestFiles ?? []).map((f) => f.storage_path).filter(Boolean);
  if (uploadPaths.length) cleanups.push(admin.storage.from("request-uploads").remove(uploadPaths));

  // expedition-docs: documentos + actas con adjunto
  const expeditionDocPaths = (expeditionDocs ?? []).map((d) => d.storage_path).filter(Boolean);
  const minutesPaths = (meetingMinutes ?? [])
    .map((m) => m.storage_path)
    .filter(Boolean) as string[];
  const allExpeditionDocPaths = [...expeditionDocPaths, ...minutesPaths];
  if (allExpeditionDocPaths.length)
    cleanups.push(admin.storage.from("expedition-docs").remove(allExpeditionDocPaths));

  const photoPaths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
  if (photoPaths.length) cleanups.push(admin.storage.from("expedition-photos").remove(photoPaths));

  const attachmentPaths = (attachments ?? []).map((a) => a.storage_path).filter(Boolean);
  if (attachmentPaths.length)
    cleanups.push(admin.storage.from("expedition-attachments").remove(attachmentPaths));

  if (certificatePdfPath)
    cleanups.push(admin.storage.from("certificates").remove([certificatePdfPath]));

  await Promise.allSettled(cleanups); // allSettled: no falla aunque un bucket dé error
}

/**
 * Elimina completamente una solicitud: Storage + BD.
 * Válido para usar tanto desde rutas de admin como de cliente (con su propia
 * comprobación de permisos antes de llamar a esta función).
 */
export async function deleteRequestCompletely(
  requestId: string,
  certificatePdfPath: string | null,
): Promise<void> {
  await purgeRequestStorage(requestId, certificatePdfPath);
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("certificate_requests")
    .delete()
    .eq("id", requestId);
  if (error) throw new Error(`Error al eliminar la solicitud: ${error.message}`);
}
