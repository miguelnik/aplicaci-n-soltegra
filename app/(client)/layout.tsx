import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { FileText, LayoutDashboard, LogOut, PlusCircle, User } from "lucide-react";

async function signOut() {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireClient();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top navbar */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Image
              src="/logo.png"
              alt="Soltegra"
              width={120}
              height={32}
              className="object-contain"
              priority
            />
            <nav className="hidden items-center gap-1 md:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  Inicio
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/solicitudes">
                  <FileText className="h-4 w-4" />
                  Mis certificados
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/solicitudes/nueva">
                  <PlusCircle className="h-4 w-4" />
                  Nueva solicitud
                </Link>
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/perfil">
                <User className="h-4 w-4" />
                <span className="hidden md:inline">{profile.full_name ?? "Mi cuenta"}</span>
              </Link>
            </Button>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Salir</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
