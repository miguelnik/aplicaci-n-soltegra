import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ArrowLeft } from "lucide-react";
import { TemplateEditClient } from "../TemplateEditClient";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function EditTemplatePage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: tpl } = await admin.from("budget_templates").select("*").eq("id", id).single();
  if (!tpl) notFound();

  const { data: items } = await admin.from("budget_template_items").select("*").eq("template_id", id).order("position");
  const { data: services } = await admin.from("service_types").select("id, name").eq("is_active", true).order("display_order").order("name");

  return (
    <div className="space-y-4">
      <Link href="/admin/presupuestos/plantillas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a plantillas
      </Link>
      <h2 className="text-xl font-bold">Editar plantilla</h2>
      <TemplateEditClient
        initial={{
          id: tpl.id,
          name: tpl.name,
          description: tpl.description,
          service_type_id: tpl.service_type_id,
          is_active: tpl.is_active,
        }}
        initialItems={(items ?? []).map((it) => ({
          id: it.id,
          concept: it.concept,
          description: it.description,
          quantity: Number(it.quantity),
          unit: it.unit,
          unit_price: Number(it.unit_price),
          discount_pct: Number(it.discount_pct),
        }))}
        services={services ?? []}
      />
    </div>
  );
}
