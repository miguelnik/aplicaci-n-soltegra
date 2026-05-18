"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export interface TabItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Si true, sólo está "activa" cuando pathname === href exacto.
      Si false (default), activa también cuando pathname empieza con href. */
  exact?: boolean;
}

interface Props {
  tabs: TabItem[];
}

export function TabsNav({ tabs }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 border-b">
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + "/"));
        return (
          <Link
            key={href}
            href={href}
            className={
              "flex items-center gap-1.5 rounded-t-md px-4 py-2 text-sm font-medium transition-colors " +
              (active
                ? "border border-b-0 border-border bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
          </Link>
        );
      })}
    </div>
  );
}
