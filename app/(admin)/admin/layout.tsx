import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  Building2,
} from "lucide-react";


async function signOut() {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Image
            src="/logo.png"
            alt="Soltegra"
            width={130}
            height={36}
            className="object-contain"
            priority
          />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/admin/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/admin/solicitudes">
              <FileText className="h-4 w-4" />
              Solicitudes
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/admin/clientes">
              <Building2 className="h-4 w-4" />
              Clientes
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/admin/usuarios">
              <Users className="h-4 w-4" />
              Usuarios
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="justify-start" asChild>
            <Link href="/admin/formulario">
              <Settings className="h-4 w-4" />
              Formulario
            </Link>
          </Button>
        </nav>
        <div className="border-t p-3">
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
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
