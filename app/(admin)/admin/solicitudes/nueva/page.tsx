import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveServices } from "@/lib/services";
import { ArrowLeft } from "lucide-react";
import { NewAdminRequestClient } from "./NewAdminRequestClient";

export const dynamic = "force-dynamic";

export default async function NewAdminRequestPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  // Cargar clientes (organizaciones) y servicios activos
  const [{ data: orgs }, services] = await Promise.all([
    admin.from("organizations").select("id, name").order("name"),
    getActiveServices(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/solicitudes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a Solicitudes
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Nueva solicitud</h1>
        <p className="text-sm text-muted-foreground">
          Crea un proyecto en nombre de un cliente. Podrás decidir si lo verá o no, y rellenar el resto de datos después en la vista del proyecto.
        </p>
      </div>

      <NewAdminRequestClient
        organizations={orgs ?? []}
        services={services.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
      />
    </div>
  );
}
