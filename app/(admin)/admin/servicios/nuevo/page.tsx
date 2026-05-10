import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { nameToSlug } from "@/lib/services";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { ArrowLeft } from "lucide-react";

async function createService(formData: FormData) {
  "use server";
  const profile = await requireAdmin();
  const admin = createSupabaseAdminClient();

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const icon = (formData.get("icon") as string)?.trim() || "FileText";

  if (!name) {
    redirect("/admin/servicios/nuevo?error=" + encodeURIComponent("El nombre es obligatorio"));
  }

  const slug = nameToSlug(name);

  // Crear el servicio
  const { data: service, error: svcErr } = await admin
    .from("service_types")
    .insert({
      slug,
      name,
      description,
      icon,
      is_active: true,
      display_order: 0,
    })
    .select("id")
    .single();

  if (svcErr || !service) {
    const msg = svcErr?.code === "23505" ? "Ya existe un servicio con ese nombre" : (svcErr?.message ?? "Error desconocido");
    redirect("/admin/servicios/nuevo?error=" + encodeURIComponent(msg));
  }

  // Crear schema vacío inicial para el servicio
  const emptySchema = { sections: [] };
  const { error: schemaErr } = await admin
    .from("form_schemas")
    .insert({
      version: 1,
      is_current: true,
      is_draft: false,
      schema: emptySchema,
      service_type_id: service.id,
      created_by: profile.id,
    });

  if (schemaErr) {
    // Intentamos rollback del servicio
    await admin.from("service_types").delete().eq("id", service.id);
    redirect("/admin/servicios/nuevo?error=" + encodeURIComponent("Error creando formulario inicial: " + schemaErr.message));
  }

  redirect(`/admin/servicios/${service.id}/formulario?created=1`);
}

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function NuevoServicioPage({ searchParams }: Props) {
  await requireAdmin();
  const { error } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/servicios"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a servicios
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Nuevo servicio</h1>
        <p className="text-sm text-muted-foreground">
          Una vez creado, podrás configurar su formulario.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Datos del servicio</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createService} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Ej: Estudio estructural, Inspección técnica..."
              />
              <p className="text-xs text-muted-foreground">
                Aparece como opción cuando el cliente crea una nueva solicitud.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción breve</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Qué cubre este servicio (visible para el cliente)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icono (opcional)</Label>
              <Input
                id="icon"
                name="icon"
                defaultValue="FileText"
                placeholder="FileText"
              />
              <p className="text-xs text-muted-foreground">
                Nombre de un icono de Lucide. Por defecto: FileText.
              </p>
            </div>

            <SubmitButton pendingText="Creando...">
              Crear servicio
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
