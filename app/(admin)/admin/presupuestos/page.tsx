import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CalendarDays, CheckCircle2, Euro, FileText, Filter, Plus, Send, XCircle } from "lucide-react";
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
  const budgetViews = budgets.map((b) => {
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

    return {
      budget: b,
      org,
      con,
      owner,
      totals,
      status: b.status as BudgetStatus,
      clientName: b.client_legal_name ?? org?.name ?? con?.full_name ?? "—",
    };
  });
  const totalValue = budgetViews.reduce((sum, item) => sum + item.totals.total, 0);
  const sentCount = budgetViews.filter((item) => item.status === "sent").length;
  const acceptedCount = budgetViews.filter((item) => item.status === "accepted").length;
  const rejectedCount = budgetViews.filter((item) => item.status === "rejected" || item.status === "expired").length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">Ventas</p>
            <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Controla propuestas emitidas, estado comercial e importe previsto.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/presupuestos/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo presupuesto
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Presupuestos visibles</p>
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{budgetViews.length}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Valor total</p>
            <Euro className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{eur(totalValue)}</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Aceptados</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{acceptedCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sentCount} enviados pendientes</p>
        </div>
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Rechazados/caducados</p>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{rejectedCount}</p>
        </div>
      </div>

      <form className="rounded-lg border bg-background p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-1">
              <label className="text-xs font-medium">Estado</label>
              <select
                name="status"
                defaultValue={sp.status ?? ""}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                {STATUS_OPTS.map((s) => (<option key={s} value={s}>{BUDGET_STATUS_LABEL[s]}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Buscar</label>
              <Input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="Nº, título o cliente" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 lg:flex-none">
              <Filter className="h-4 w-4" />
              Filtrar
            </Button>
            {(sp.status || sp.q) && (
              <Button variant="outline" asChild>
                <Link href="/admin/presupuestos">Limpiar</Link>
              </Button>
            )}
          </div>
        </div>
      </form>

      {budgetViews.length === 0 ? (
        <div className="rounded-lg border bg-background px-4 py-10 text-center shadow-sm">
          <p className="font-medium">
            {sp.status || sp.q ? "Sin presupuestos con esos filtros." : "Aún no hay presupuestos."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {sp.status || sp.q ? "Ajusta los filtros para ampliar la búsqueda." : "Crea el primer presupuesto para empezar a medir ventas."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="hidden overflow-x-auto rounded-lg border bg-background shadow-sm md:block">
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
                {budgetViews.map(({ budget: b, owner, totals, status, clientName }) => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/admin/presupuestos/${b.id}`} className="text-primary hover:underline">{b.number ?? "—"}</Link>
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-2">{b.title}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{clientName}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={BUDGET_STATUS_COLOR[status]}>
                        {BUDGET_STATUS_LABEL[status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{eur(totals.total)}</td>
                    <td className="px-3 py-2 text-xs">{b.issue_date ? format(parseISO(b.issue_date), "d MMM yyyy", { locale: es }) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{b.valid_until ? format(parseISO(b.valid_until), "d MMM yyyy", { locale: es }) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{owner?.full_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {budgetViews.map(({ budget: b, owner, totals, status, clientName }) => (
              <Link
                key={b.id}
                href={`/admin/presupuestos/${b.id}`}
                className="rounded-lg border bg-background p-4 shadow-sm transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-xs text-muted-foreground">{b.number ?? "Sin número"}</p>
                    <p className="truncate font-semibold">{b.title}</p>
                    <p className="text-sm text-muted-foreground">{clientName}</p>
                  </div>
                  <Badge variant="outline" className={BUDGET_STATUS_COLOR[status]}>
                    {BUDGET_STATUS_LABEL[status]}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="font-mono text-lg font-semibold">{eur(totals.total)}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Send className="h-3.5 w-3.5" />
                    {owner?.full_name ?? "Sin comercial"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    Emitido {b.issue_date ? format(parseISO(b.issue_date), "d MMM yyyy", { locale: es }) : "sin fecha"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    Válido hasta {b.valid_until ? format(parseISO(b.valid_until), "d MMM yyyy", { locale: es }) : "sin fecha"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
