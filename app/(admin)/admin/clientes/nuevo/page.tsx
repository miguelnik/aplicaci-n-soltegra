import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

async function createOrg(formData: FormData) {
  "use server";
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("organizations")
    .insert({
      name: formData.get("name") as string,
      cif: (formData.get("cif") as string) || null,
      contact_email: (formData.get("contact_email") as string) || null,
      contact_phone: (formData.get("contact_phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error || !data) redirect("/admin/clientes?error=1");
  redirect(`/admin/clientes/${data.id}`);
}

export default async function NuevoClientePage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nuevo cliente</h1>
        <p className="text-muted-foreground">
          Crea la organización y después invita a sus usuarios.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la organización</CardTitle>
          <CardDescription>
            Empresa o particular. Para particulares, usa su nombre como nombre de la org.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createOrg} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input id="name" name="name" required placeholder="Inmobiliaria Ejemplo S.L." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cif">CIF / NIF</Label>
              <Input id="cif" name="cif" placeholder="B12345678" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email de contacto</Label>
                <Input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  placeholder="contacto@empresa.es"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Teléfono</Label>
                <Input id="contact_phone" name="contact_phone" placeholder="958 000 000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas internas</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Condiciones especiales, observaciones..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <SubmitButton className="flex-1" pendingText="Creando...">
                Crear cliente
              </SubmitButton>
              <Button variant="outline" asChild>
                <Link href="/admin/clientes">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
