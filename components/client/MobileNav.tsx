"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FileText, LayoutDashboard, Menu, PlusCircle, User } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/solicitudes", label: "Mis solicitudes", icon: FileText },
  { href: "/solicitudes/nueva", label: "Nueva solicitud", icon: PlusCircle },
  { href: "/perfil", label: "Mi cuenta", icon: User },
];

export function ClientMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 pt-10">
        <nav className="flex flex-col gap-1 p-3">
          {links.map(({ href, label, icon: Icon }) => (
            <Button
              key={href}
              variant={pathname === href || (href !== "/dashboard" && pathname.startsWith(href)) ? "secondary" : "ghost"}
              size="sm"
              className="justify-start"
              asChild
              onClick={() => setOpen(false)}
            >
              <Link href={href}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </Button>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
