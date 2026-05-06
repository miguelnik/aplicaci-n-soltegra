import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con SERVICE_ROLE: bypassa RLS y tiene acceso total a la DB.
 * SOLO debe usarse desde código de servidor (server actions, API routes).
 * Nunca exportar a cliente — `server-only` aborta el build si se intenta.
 *
 * Casos de uso: invitar usuarios, crear perfiles iniciales, jobs administrativos.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
