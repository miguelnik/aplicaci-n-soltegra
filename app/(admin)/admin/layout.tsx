import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { AdminMobileNav, AdminSidebarNav } from "@/components/admin/MobileNav";

async function signOut() {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const isSuper = me.role === "superadmin";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <AdminMobileNav isSuperadmin={isSuper} />
        <Link href="/admin/dashboard">
          <Image
            src="/logo.png"
            alt="Soltegra"
            width={100}
            height={28}
            className="object-contain"
            priority
          />
        </Link>
        <form action={signOut}>
          <Button variant="ghost" size="icon" type="submit">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </header>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/admin/dashboard">
            <Image
              src="/logo.png"
              alt="Soltegra"
              width={130}
              height={36}
              className="object-contain"
              priority
            />
          </Link>
        </div>
        <AdminSidebarNav isSuperadmin={isSuper} />
        <div className="border-t p-3">
          <div className="mb-2 rounded-md bg-muted/60 px-3 py-2">
            <p className="truncate text-sm font-medium">{me.full_name ?? "Administrador"}</p>
            <p className="text-xs text-muted-foreground">
              {isSuper ? "Superadministrador" : "Administrador"}
            </p>
          </div>
          <form action={signOut}>
            <Button variant="ghost" size="sm" className="w-full justify-start" type="submit">
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
