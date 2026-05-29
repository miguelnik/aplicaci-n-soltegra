// ============================================================================
// Helper para generar signed URLs en BATCH para múltiples objetos del mismo
// bucket. Reduce N roundtrips a 1.
//
// Uso:
//   const map = await batchSignedUrls(supabase, "expedition-photos", paths);
//   const url = map[somePath] ?? null;
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

/** Genera signed URLs para una lista de paths en un mismo bucket.
 *  Devuelve un mapa path → url (o null si falló). */
export async function batchSignedUrls(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
  expiresIn = 900,
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  if (paths.length === 0) return out;

  // Desduplica para no pedir URLs repetidas (raro, pero por si acaso)
  const unique = Array.from(new Set(paths));

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrls(unique, expiresIn);

  if (error || !data) {
    // Si falla la llamada batch, devolvemos null para cada path
    for (const p of unique) out[p] = null;
    return out;
  }

  for (const item of data) {
    // item.path es el path original; item.signedUrl es la URL firmada
    if (item.path) out[item.path] = item.signedUrl ?? null;
  }
  return out;
}
