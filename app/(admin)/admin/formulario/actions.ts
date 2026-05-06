"use server";

import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormSchema } from "@/lib/form-schema/types";

export async function saveFormSchema(schema: FormSchema) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  // Obtener la versión más alta actual
  const { data: maxRow } = await supabase
    .from("form_schemas")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (maxRow?.version ?? 0) + 1;

  // Desactivar la versión actual en una transacción (Supabase no tiene transacciones
  // en el cliente, así que lo hacemos en dos pasos — el índice unique parcial nos protege)
  await supabase.from("form_schemas").update({ is_current: false }).eq("is_current", true);

  const { error } = await supabase.from("form_schemas").insert({
    version: nextVersion,
    is_current: true,
    is_draft: false,
    schema: schema as unknown as Record<string, unknown>,
  });

  if (error) throw new Error(error.message);
}
