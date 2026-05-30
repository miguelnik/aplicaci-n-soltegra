"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  FileText,
  LayoutDashboard,
  Menu,
  Users,
  Building2,
  Briefcase,
  Wallet,
  Clock,
  Target,
  ListChecks,
  Receipt,
  Settings,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Operación",
    links: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/solicitudes", label: "Proyectos", icon: FileText },
      { href: "/admin/tareas", label: "Tareas", icon: ListChecks },
      { href: "/admin/horas", label: "Horas", icon: Clock },
    ],
  },
  {
    label: "Negocio",
    links: [
      { href: "/admin/crm", label: "CRM", icon: Target },
      { href: "/admin/presupuestos", label: "Presupuestos", icon: Receipt },
      { href: "/admin/contabilidad", label: "Contabilidad", icon: Wallet },
      { href: "/admin/clientes", label: "Clientes", icon: Building2 },
    ],
  },
  {
    label: "Configuración",
    links: [
      { href: "/admin/servicios", label: "Servicios", icon: Briefcase },
      { href: "/admin/usuarios", label: "Usuarios", icon: Users },
      { href: "/admin/ajustes/empresa", label: "Ajustes empresa", icon: Settings, superOnly: true },
      { href: "/admin/ajustes/ia", label: "Base de conocimiento IA", icon: Sparkles, superOnly: true },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`));
}

function AdminNavItems({
  isSuperadmin = false,
  onNavigate,
}: {
  isSuperadmin?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {navGroups.map((group) => {
        const visibleLinks = group.links.filter((link) => !link.superOnly || isSuperadmin);
        if (visibleLinks.length === 0) return null;

        return (
          <div key={group.label} className="space-y-1">
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            {visibleLinks.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

export function AdminSidebarNav({ isSuperadmin }: { isSuperadmin: boolean }) {
  return (
    <nav className="flex flex-1 flex-col gap-2 p-3">
      <AdminNavItems isSuperadmin={isSuperadmin} />
    </nav>
  );
}

export function AdminMobileNav({ isSuperadmin = false }: { isSuperadmin?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 pt-10">
        <nav className="flex flex-col gap-2 p-3">
          <AdminNavItems isSuperadmin={isSuperadmin} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
