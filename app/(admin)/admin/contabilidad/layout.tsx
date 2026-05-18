import { requireAdmin } from "@/lib/auth";
import { TabsNav, type TabItem } from "@/components/admin/TabsNav";
import { Wallet, BarChart3, ListChecks, Plus } from "lucide-react";

const ICON_CLS = "h-3.5 w-3.5";

const TABS: TabItem[] = [
  { href: "/admin/contabilidad",             label: "Dashboard",   icon: <BarChart3  className={ICON_CLS} />, exact: true },
  { href: "/admin/contabilidad/movimientos", label: "Movimientos", icon: <ListChecks className={ICON_CLS} /> },
  { href: "/admin/contabilidad/p-y-l",       label: "P&L",         icon: <Wallet     className={ICON_CLS} /> },
  { href: "/admin/contabilidad/nueva",       label: "Nuevo",       icon: <Plus       className={ICON_CLS} /> },
];

export default async function ContabilidadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Admin</span>
          <span>/</span>
          <span>Contabilidad</span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wallet className="h-6 w-6 text-primary" />
          Contabilidad
        </h1>
        <p className="text-sm text-muted-foreground">
          Control de ingresos, gastos y P&L. Sólo visible para administradores.
        </p>
      </div>

      <TabsNav tabs={TABS} />

      <div>{children}</div>
    </div>
  );
}
