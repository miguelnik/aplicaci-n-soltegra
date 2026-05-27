import { requireAdmin } from "@/lib/auth";
import { TabsNav, type TabItem } from "@/components/admin/TabsNav";
import { FileText, Layers, LayoutTemplate } from "lucide-react";

const ICON_CLS = "h-3.5 w-3.5";

const TABS: TabItem[] = [
  { href: "/admin/presupuestos",            label: "Presupuestos", icon: <Layers className={ICON_CLS} />, exact: true },
  { href: "/admin/presupuestos/plantillas", label: "Plantillas",   icon: <LayoutTemplate className={ICON_CLS} /> },
];

export default async function PresupuestosLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileText className="h-6 w-6 text-primary" />
          Presupuestos
        </h1>
        <p className="text-sm text-muted-foreground">
          Crea, edita y descarga presupuestos en PDF con tu logo y datos fiscales.
        </p>
      </div>

      <TabsNav tabs={TABS} />

      <div>{children}</div>
    </div>
  );
}
