"use server";

import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FormSchema } from "@/lib/form-schema/types";

export async function saveFormSchema(
  schema: FormSchema,
  serviceTypeId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (!serviceTypeId) {
      return { ok: false, error: "Falta el servicio asociado" };
    }

    // Obtener la versión más alta actual PARA ESE SERVICIO
    const { data: maxRow } = await admin
      .from("form_schemas")
      .select("version")
      .eq("service_type_id", serviceTypeId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (maxRow?.version ?? 0) + 1;

    // Desactivar la versión actual del servicio
    await admin
      .from("form_schemas")
      .update({ is_current: false })
      .eq("service_type_id", serviceTypeId)
      .eq("is_current", true);

    const { error } = await admin.from("form_schemas").insert({
      version: nextVersion,
      is_current: true,
      is_draft: false,
      schema: schema as unknown as Record<string, unknown>,
      service_type_id: serviceTypeId,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
