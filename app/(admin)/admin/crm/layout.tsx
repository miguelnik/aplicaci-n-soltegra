import { requireAdmin } from "@/lib/auth";
import { TabsNav, type TabItem } from "@/components/admin/TabsNav";
import { Target, Trello, Layers, Users2, BarChart3, Filter, Sparkles } from "lucide-react";

const ICON_CLS = "h-3.5 w-3.5";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const isSuper = me.role === "superadmin";

  const tabs: TabItem[] = [
    { href: "/admin/crm",                label: "Embudo",        icon: <Trello className={ICON_CLS} />, exact: true },
    { href: "/admin/crm/oportunidades",  label: "Oportunidades", icon: <Layers className={ICON_CLS} /> },
    { href: "/admin/crm/contactos",      label: "Contactos",     icon: <Users2 className={ICON_CLS} /> },
    { href: "/admin/crm/funnel",         label: "Conversión",    icon: <Filter className={ICON_CLS} /> },
    { href: "/admin/crm/asistente",     label: "Asistente IA",  icon: <Sparkles className={ICON_CLS} /> },
  ];
  if (isSuper) {
    tabs.push({ href: "/admin/crm/comerciales", label: "Comerciales", icon: <BarChart3 className={ICON_CLS} /> });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Target className="h-6 w-6 text-primary" />
          CRM
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestión de contactos, oportunidades comerciales y comunicaciones.
        </p>
      </div>

      <TabsNav tabs={tabs} />

      <div>{children}</div>
    </div>
  );
}
