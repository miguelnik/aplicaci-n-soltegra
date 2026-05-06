import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Revisa tu email</CardTitle>
          <CardDescription>
            Si la cuenta existe, recibirás un email con el enlace para restablecer tu contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            Volver al inicio de sesión
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Restablecer contraseña</CardTitle>
        <CardDescription>
          Introduce tu email y te enviaremos un enlace para crear una nueva contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={sendResetEmail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </div>
          <Button type="submit" className="w-full">
            Enviar enlace
          </Button>
          <div className="text-center">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
              Volver al inicio de sesión
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
