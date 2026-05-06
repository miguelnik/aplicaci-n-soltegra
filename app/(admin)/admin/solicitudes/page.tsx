import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/client/StatusBadge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";

const STATUSES = [
  { value: "", label: "Todas" },
  { value: "submitted", label: "Nuevas" },
  { value: "in_review", label: "En revisión" },
  { value: "in_progress", label: "En redacción" },
  { value: "awaiting_info", label: "Pend. info" },
  { value: "delivered", label: "Entregadas" },
  { value: "cancelled", label: "Canceladas" },
];

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminSolicitudesPage({ searchParams }: Props) {
  await requireAdmin();
  const { status } = await searchParams;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("certificate_requests")
    .select(`id, reference_code, property_address, status, created_at, estimated_delivery_date, organizations(name)`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);

  const { data: requests } = await query;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Solicitudes</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={s.value ? `/admin/solicitudes?status=${s.value}` : "/admin/solicitudes"}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              (status ?? "") === s.value
                ? "border-primary bg-primary text-white"
                : "border-border hover:border-primary/50"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Referencia</th>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="px-4 py-3 text-left font-medium">Dirección</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests?.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs font-medium">
                  {r.reference_code ?? <span className="text-muted-foreground">Sin ref.</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {(r.organizations as unknown as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3">
                  {r.property_address ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {format(new Date(r.created_at), "dd/MM/yy")}
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/solicitudes/${r.id}`}>
                      Ver
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!requests?.length && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Sin solicitudes con este filtro.
          </div>
        )}
      </div>
    </div>
  );
}
