import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CompanySettingsClient } from "./CompanySettingsClient";
import type { CompanySettings } from "@/lib/budgets/types";

export const dynamic = "force-dynamic";

export default async function CompanySettingsPage() {
  const me = await requireAdmin();
  if (me.role !== "superadmin") {
    redirect("/admin/dashboard");
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("company_settings").select("*").limit(1).maybeSingle();
  const settings = (data ?? null) as CompanySettings | null;

  // Nunca pasar la API key descifrada al cliente — solo un booleano.
  const aiConfig = {
    hasApiKey: !!settings?.openai_api_key_encrypted,
    model: settings?.openai_model ?? "gpt-4o-mini",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Datos de la empresa</h1>
        <p className="text-sm text-muted-foreground">
          Estos datos aparecen en todos los presupuestos y documentos generados por la plataforma. Sólo el superadministrador puede editarlos.
        </p>
      </div>

      {settings && <CompanySettingsClient initial={settings} aiConfig={aiConfig} />}
    </div>
  );
}
