import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { AlertCircle, LockKeyhole, Mail } from "lucide-react";

async function login(formData: FormData) {
  "use server";

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("Email o contraseña incorrectos")}`);
  }

  redirect("/");
}

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  // Si ya está autenticado, redirige.
  const profile = await getCurrentProfile();
  if (profile) redirect("/");

  return (
    <Card className="border-border/80 shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 rounded-md border bg-white px-4 py-3 lg:hidden">
          <Image
            src="/logo.png"
            alt="Soltegra"
            width={170}
            height={52}
            className="object-contain"
            priority
          />
        </div>
        <CardTitle className="text-xl">Accede a tu portal</CardTitle>
        <CardDescription>Introduce tus credenciales para continuar.</CardDescription>
      </CardHeader>
      <CardContent>
        {params.error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{params.error}</span>
          </div>
        )}
        <form action={login} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                required
                autoComplete="email"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                href="/reset-password"
                className="text-xs text-muted-foreground hover:text-primary"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="pl-9"
              />
            </div>
          </div>
          <SubmitButton className="w-full" pendingText="Entrando...">
            Iniciar sesión
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
