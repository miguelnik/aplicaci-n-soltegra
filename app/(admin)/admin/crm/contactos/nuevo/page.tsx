import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ArrowLeft } from "lucide-react";
import { NewContactClient } from "./NewContactClient";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: orgs }, { data: workers }] = await Promise.all([
    admin.from("organizations").select("id, name").order("name"),
    admin.from("profiles").select("id, full_name").in("role", ["admin", "superadmin"]).order("full_name"),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/admin/crm/contactos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </Link>
      <h2 className="text-xl font-bold">Nuevo contacto</h2>
      <NewContactClient organizations={orgs ?? []} workers={workers ?? []} />
    </div>
  );
}
