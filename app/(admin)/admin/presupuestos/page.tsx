import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  BUDGET_STATUS_LABEL, BUDGET_STATUS_COLOR,
  type BudgetStatus, computeBudgetTotals, type BudgetItem,
} from "@/lib/budgets/types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0,
});

const STATUS_OPTS: BudgetStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];

export default async function BudgetsPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  let q = admin
    .from("budgets")
    .select(`
      *,
      organizations:organization_id ( name ),
      contacts:contact_id ( full_name ),
      profiles:owner_id ( full_name ),
      budget_items ( quantity, unit_price, discount_pct )
    `)
    .order("created_at", { ascending: false });

  if (sp.status && STATUS_OPTS.includes(sp.status as BudgetStatus)) {
    q = q.eq("status", sp.status);
  }
  if (sp.q?.trim()) {
    q = q.or(`title.ilike.%${sp.q}%,number.ilike.%${sp.q}%,client_legal_name.ilike.%${sp.q}%`);
  }

  const { data: rows } = await q;
  const budgets = rows ?? [];

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Estado</label>
          <select name="status" defaultValue={sp.status ?? ""} className="h-8 w-44 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todos</option>
            {STATUS_OPTS.map((s) => (<option key={s} value={s}>{BUDGET_STATUS_LABEL[s]}</option>))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px] space-y-1">
          <label className="text-xs font-medium">Buscar</label>
          <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="Nº, título o cliente…" className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
        </div>
        <button type="submit" className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90">
          Filtrar
        </button>
        <Link href="/admin/presupuestos" className="text-xs text-muted-foreground hover:text-foreground">Limpiar</Link>
        <div className="ml-auto">
          <Button asChild size="sm">
            <Link href="/admin/presupuestos/nuevo">
              <Plus className="h-3.5 w-3.5" />
              Nuevo presupuesto
            </Link>
          </Button>
        </div>
      </form>

      {budgets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {sp.status || sp.q ? "Sin presupuestos con esos filtros." : "Aún no hay presupuestos. Crea el primero."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Nº</th>
                <th className="px-3 py-2 text-left font-medium">Título</th>
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-left font-medium">Emitido</th>
                <th className="px-3 py-2 text-left font-medium">Válido hasta</th>
                <th className="px-3 py-2 text-left font-medium">Comercial</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {budgets.map((b) => {
                const org = b.organizations as { name?: string | null } | null;
                const con = b.contacts as { full_name?: string | null } | null;
                const owner = b.profiles as { full_name?: string | null } | null;
                const items = (b.budget_items ?? []) as BudgetItem[];
                const totals = computeBudgetTotals(items.map((it, idx) => ({
                  id: String(idx), budget_id: b.id, position: idx,
                  concept: "", description: null,
                  quantity: Number(it.quantity), unit: "ud",
                  unit_price: Number(it.unit_price), discount_pct: Number(it.discount_pct),
                })), Number(b.vat_pct));
                return (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/admin/presupuestos/${b.id}`} className="text-primary hover:underline">{b.number ?? "—"}</Link>
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-2">{b.title}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {b.client_legal_name ?? org?.name ?? con?.full_name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={BUDGET_STATUS_COLOR[b.status as BudgetStatus]}>
                        {BUDGET_STATUS_LABEL[b.status as BudgetStatus]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{eur(totals.total)}</td>
                    <td className="px-3 py-2 text-xs">{b.issue_date ? format(parseISO(b.issue_date), "d MMM yyyy", { locale: es }) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{b.valid_until ? format(parseISO(b.valid_until), "d MMM yyyy", { locale: es }) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{owner?.full_name ?? "—"}</td>
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
