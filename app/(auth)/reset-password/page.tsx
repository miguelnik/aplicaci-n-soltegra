import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";

async function sendResetEmail(formData: FormData) {
  "use server";

  const email = formData.get("email") as string;
  const supabase = await createSupabaseServerClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/set-password`,
  });

  // Siempre redirigimos con éxito aunque el email no exista (seguridad).
  redirect("/reset-password?sent=1");
}

interface Props {
  searchParams: Promise<{ sent?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;

  if (params.sent) {
    return (
      <Card className="border-border/80 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-emerald-100">
            <CheckCircle2 className="h-6 w-6 text-emerald-700" />
          </div>
          <CardTitle>Revisa tu email</CardTitle>
          <CardDescription>
            Si la cuenta existe, recibirás un email con el enlace para restablecer tu contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a iniciar sesión
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Restablecer contraseña</CardTitle>
        <CardDescription>
          Introduce tu email y te enviaremos un enlace para crear una nueva contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={sendResetEmail} className="space-y-4">
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
          <Button type="submit" className="w-full">
            Enviar enlace
          </Button>
          <div className="text-center">
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al inicio de sesión
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
