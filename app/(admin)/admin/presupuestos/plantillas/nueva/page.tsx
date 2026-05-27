import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ArrowLeft } from "lucide-react";
import { TemplateEditClient } from "../TemplateEditClient";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: services } = await admin
    .from("service_types")
    .select("id, name")
    .eq("is_active", true)
    .order("display_order").order("name");

  return (
    <div className="space-y-4">
      <Link href="/admin/presupuestos/plantillas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a plantillas
      </Link>
      <h2 className="text-xl font-bold">Nueva plantilla</h2>
      <TemplateEditClient services={services ?? []} />
    </div>
  );
}
