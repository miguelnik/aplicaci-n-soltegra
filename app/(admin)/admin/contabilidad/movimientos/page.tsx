import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FinanceEntriesTable } from "@/components/admin/FinanceEntriesTable";
import { Card, CardContent } from "@/components/ui/card";
import {
  INCOME_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  type FinanceEntry,
  type FinanceKind,
  type IncomeCategory,
  type ExpenseCategory,
} from "@/lib/finance/types";

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

interface Props {
  searchParams: Promise<{
    kind?: string;
    category?: string;
    settled?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function MovimientosPage({ searchParams }: Props) {
  await requireAdmin();
  const filters = await searchParams;
  const admin = createSupabaseAdminClient();

  // ── Aplicar filtros server-side donde es directo ────────────────────────
  let q = admin
    .from("finance_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.kind === "income" || filters.kind === "expense") {
    q = q.eq("kind", filters.kind);
  }
  if (filters.category && filters.category !== "all") {
    q = q.eq("category", filters.category);
  }
  if (filters.settled === "yes") {
    q = q.eq("is_settled", true);
  } else if (filters.settled === "no") {
    q = q.eq("is_settled", false);
  }
  if (filters.from) q = q.gte("entry_date", filters.from);
  if (filters.to)   q = q.lte("entry_date", filters.to);

  const { data: rows } = await q;
  const entries = (rows ?? []) as FinanceEntry[];

  // ── Cargar info de proyectos y orgs vinculados (para mostrar en tabla) ─
  const requestIds = Array.from(new Set(entries.map((e) => e.request_id).filter((x): x is string => !!x)));
  const orgIds = Array.from(new Set(entries.map((e) => e.organization_id).filter((x): x is string => !!x)));

  const projectsById: Record<string, { reference_code: string | null; property_address: string | null }> = {};
  if (requestIds.length > 0) {
    const { data: rs } = await admin
      .from("certificate_requests")
      .select("id, reference_code, property_address")
      .in("id", requestIds);
    for (const r of rs ?? []) {
      projectsById[r.id] = {
        reference_code: r.reference_code,
        property_address: r.property_address,
      };
    }
  }

  const orgsById: Record<string, string> = {};
  if (orgIds.length > 0) {
    const { data: os } = await admin
      .from("organizations")
      .select("id, name")
      .in("id", orgIds);
    for (const o of os ?? []) orgsById[o.id] = o.name;
  }

  // ── Totales del subconjunto filtrado ────────────────────────────────────
  const totalIngresos = entries.filter((e) => e.kind === "income").reduce((a, e) => a + Number(e.amount), 0);
  const totalGastos = entries.filter((e) => e.kind === "expense").reduce((a, e) => a + Number(e.amount), 0);
  const balance = totalIngresos - totalGastos;

  // ── Opciones de categoría según kind activo ─────────────────────────────
  const categoryOptions: { value: string; label: string }[] = [
    { value: "all", label: "Todas las categorías" },
  ];
  if (filters.kind === "income") {
    for (const [k, label] of Object.entries(INCOME_CATEGORY_LABELS)) {
      categoryOptions.push({ value: k, label });
    }
  } else if (filters.kind === "expense") {
    for (const [k, label] of Object.entries(EXPENSE_CATEGORY_LABELS)) {
      categoryOptions.push({ value: k, label });
    }
  } else {
    for (const [k, label] of Object.entries(INCOME_CATEGORY_LABELS)) {
      categoryOptions.push({ value: k, label: `Ingreso · ${label}` });
    }
    for (const [k, label] of Object.entries(EXPENSE_CATEGORY_LABELS)) {
      categoryOptions.push({ value: `e_${k}`, label: `Gasto · ${label}` });
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <label className="text-xs font-medium">Tipo</label>
              <select
                name="kind"
                defaultValue={filters.kind ?? "all"}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="income">Ingresos</option>
                <option value="expense">Gastos</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Categoría</label>
              <select
                name="category"
                defaultValue={filters.category ?? "all"}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {categoryOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Desde</label>
              <input
                type="date"
                name="from"
                defaultValue={filters.from ?? ""}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Hasta</label>
              <input
                type="date"
                name="to"
                defaultValue={filters.to ?? ""}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Estado</label>
              <select
                name="settled"
                defaultValue={filters.settled ?? "all"}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="yes">Cobrados/pagados</option>
                <option value="no">Pendientes</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-5 flex gap-2">
              <button type="submit" className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
                Aplicar filtros
              </button>
              <a href="/admin/contabilidad/movimientos" className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted">
                Limpiar
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Resumen del subconjunto */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">Ingresos</p>
          <p className="font-mono text-lg font-semibold text-green-700">{eur(totalIngresos)}</p>
        </div>
        <div className="rounded-md border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="font-mono text-lg font-semibold text-orange-600">{eur(totalGastos)}</p>
        </div>
        <div className="rounded-md border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className={`font-mono text-lg font-semibold ${balance >= 0 ? "text-green-700" : "text-red-600"}`}>
            {eur(balance)}
          </p>
        </div>
      </div>

      {/* Tabla */}
      <FinanceEntriesTable
        entries={entries}
        showProject
        projectsById={projectsById}
        showClient
        orgsById={orgsById}
        emptyText="No hay movimientos con esos filtros."
      />
    </div>
  );
}
