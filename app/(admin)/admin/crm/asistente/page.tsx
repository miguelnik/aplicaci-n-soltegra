import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AiChat } from "@/components/ai/AiChat";

export const dynamic = "force-dynamic";

export default async function AsistenteComercialPage() {
  await requireAdmin();

  const admin = createSupabaseAdminClient();
  const { data: company } = await admin
    .from("company_settings")
    .select("openai_api_key_encrypted")
    .limit(1)
    .maybeSingle();

  const hasApiKey = !!company?.openai_api_key_encrypted;

  return (
    <AiChat
      endpoint="/api/ai/chat"
      hasApiKey={hasApiKey}
      placeholder="Pregunta sobre servicios, capacidades, tipos de proyecto…"
    />
  );
}
