import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: templates } = await admin
    .from("budget_templates")
    .select(`
      *,
      service_types:service_type_id ( name ),
      items_count:budget_template_items(count)
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Plantillas reutilizables para crear presupuestos en segundos. Cada plantilla agrupa partidas predefinidas (concepto, cantidad, precio).
        </p>
        <Button asChild size="sm">
          <Link href="/admin/presupuestos/plantillas/nueva">
            <Plus className="h-3.5 w-3.5" />
            Nueva plantilla
          </Link>
        </Button>
      </div>

      {(templates ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin plantillas todavía. Crea la primera para acelerar tus presupuestos.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(templates ?? []).map((t) => {
            const svc = t.service_types as { name?: string | null } | null;
            const itemsCount = Array.isArray(t.items_count) ? t.items_count[0]?.count ?? 0 : 0;
            return (
              <Link
                key={t.id}
                href={`/admin/presupuestos/plantillas/${t.id}`}
                className="block rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <FileText className="mt-0.5 h-4 w-4 text-primary" />
                  {!t.is_active && <Badge variant="outline" className="text-[10px]">Inactiva</Badge>}
                </div>
                <h3 className="mt-2 font-medium">{t.name}</h3>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{itemsCount} partida{itemsCount !== 1 ? "s" : ""}</span>
                  {svc?.name && <span>{svc.name}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
