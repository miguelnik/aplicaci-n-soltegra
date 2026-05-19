import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const h = (n: number) => `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} h`;
const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

interface Props {
  searchParams: Promise<{ from?: string; to?: string; worker?: string }>;
}

/** Primer día del mes actual */
function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
/** Hoy */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function HorasPage({ searchParams }: Props) {
  const me = await requireAdmin();
  const isSuper = me.role === "superadmin";
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  const fromISO = sp.from || firstOfMonth();
  const toISO   = sp.to   || today();

  // Si NO es superadmin, fuerza filtro a "yo"
  const workerFilter = isSuper ? (sp.worker || "") : me.id;

  // Cargar lista de trabajadores (sólo si superadmin para selector)
  let workers: { id: string; full_name: string | null }[] = [];
  if (isSuper) {
    const { data } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("role", ["admin", "superadmin"])
      .order("full_name");
    workers = data ?? [];
  }

  // Cargar entradas
  let q = admin
    .from("time_entries")
    .select(`
      *,
      profiles:worker_id(full_name),
      certificate_requests:request_id(reference_code, property_address, is_general_overhead)
    `)
    .gte("entry_date", fromISO)
    .lte("entry_date", toISO)
    .order("entry_date", { ascending: false });
  if (workerFilter) q = q.eq("worker_id", workerFilter);

  const { data: rows } = await q;
  const entries = rows ?? [];

  // Totales
  const totalHours = entries.reduce((a, e) => a + Number(e.hours), 0);
  const totalCost  = entries.reduce(
    (a, e) => a + Number(e.hours) * Number(e.hourly_cost_snapshot ?? 0),
    0,
  );
  const overheadHours = entries
    .filter((e) => (e.certificate_requests as { is_general_overhead?: boolean } | null)?.is_general_overhead)
    .reduce((a, e) => a + Number(e.hours), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Clock className="h-6 w-6 text-primary" />
          Horas imputadas
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSuper
            ? "Vista global de horas. Puedes filtrar por trabajador y por rango."
            : "Tus horas imputadas en el periodo."}
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <form className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Desde</label>
              <input
                type="date"
                name="from"
                defaultValue={fromISO}
                className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Hasta</label>
              <input
                type="date"
                name="to"
                defaultValue={toISO}
                className="h-9 w-44 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            {isSuper && (
              <div className="space-y-1">
                <label className="text-xs font-medium">Trabajador</label>
                <select
                  name="worker"
                  defaultValue={workerFilter}
                  className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Todos</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>{w.full_name ?? w.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Aplicar
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">Horas totales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold">{h(totalHours)}</p>
          </CardContent>
        </Card>
        {isSuper && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-muted-foreground">Coste total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-bold text-orange-600">{eur(totalCost)}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">Horas overhead</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-blue-600">{h(overheadHours)}</p>
            <p className="text-[11px] text-muted-foreground">
              Se prorratean entre los proyectos activos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin horas imputadas en el periodo seleccionado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                {isSuper && <th className="px-3 py-2 text-left font-medium">Trabajador</th>}
                <th className="px-3 py-2 text-right font-medium">Horas</th>
                {isSuper && <th className="px-3 py-2 text-right font-medium">Coste</th>}
                <th className="px-3 py-2 text-left font-medium">Proyecto</th>
                <th className="px-3 py-2 text-left font-medium">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e) => {
                const proj = e.certificate_requests as {
                  reference_code: string | null;
                  property_address: string | null;
                  is_general_overhead: boolean;
                } | null;
                const cost = Number(e.hours) * Number(e.hourly_cost_snapshot ?? 0);
                const worker = (e.profiles as { full_name?: string | null } | null)?.full_name;
                return (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {format(parseISO(e.entry_date), "d MMM yyyy", { locale: es })}
                    </td>
                    {isSuper && (
                      <td className="px-3 py-2 text-xs">{worker ?? "—"}</td>
                    )}
                    <td className="px-3 py-2 text-right font-mono">{h(Number(e.hours))}</td>
                    {isSuper && (
                      <td className="px-3 py-2 text-right font-mono text-orange-700">
                        {cost > 0 ? eur(cost) : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-xs">
                      {e.request_id ? (
                        <Link
                          href={`/admin/solicitudes/${e.request_id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {proj?.reference_code ?? proj?.property_address ?? "ver"}
                          {proj?.is_general_overhead && (
                            <Badge variant="outline" className="ml-1 text-[9px]">overhead</Badge>
                          )}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground italic">Sin proyecto</span>
                      )}
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-xs text-muted-foreground">
                      {e.description ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
