// ============================================================================
// Cache de los emails de los usuarios de auth.
//
// listUsers() es lento (especialmente con muchos usuarios) y se usa en
// /admin/usuarios y al convertir contacto → cliente. Como los emails cambian
// muy rara vez, los cacheamos con TTL de 5 minutos.
// ============================================================================

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "./admin";

/** Mapa userId → email. */
export const getUserEmailsMap = unstable_cache(
  async (): Promise<Record<string, string | null>> => {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.auth.admin.listUsers();
    const map: Record<string, string | null> = {};
    for (const u of data?.users ?? []) {
      map[u.id] = u.email ?? null;
    }
    return map;
  },
  ["user-emails-map"],
  {
    revalidate: 300,           // 5 min
    tags: ["user-emails"],
  },
);
