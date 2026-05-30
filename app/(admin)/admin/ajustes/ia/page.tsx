import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { KnowledgeBaseEditor } from "./KnowledgeBaseEditor";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const me = await requireAdmin();
  if (me.role !== "superadmin") redirect("/admin/dashboard");

  const admin = createSupabaseAdminClient();
  const { data: kb } = await admin
    .from("ai_knowledge_base")
    .select("content, updated_at")
    .limit(1)
    .maybeSingle();

  // Comprobar si hay API key configurada
  const { data: company } = await admin
    .from("company_settings")
    .select("openai_api_key_encrypted")
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Base de conocimiento IA</h1>
        <p className="text-sm text-muted-foreground">
          Cuéntale a la IA todo sobre tu empresa: servicios, capacidades, precios,
          zonas de actuación. Esta información la usarán los comerciales a través del
          asistente de IA en el CRM.
        </p>
      </div>

      <KnowledgeBaseEditor
        initialContent={kb?.content ?? ""}
        updatedAt={kb?.updated_at ?? null}
        hasApiKey={!!company?.openai_api_key_encrypted}
      />
    </div>
  );
}
