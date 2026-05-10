import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getServiceById } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";

async function updateService(serviceId: string, formData: FormData) {
  "use server";
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const icon = (formData.get("icon") as string)?.trim() || "FileText";
  const isActive = formData.get("is_active") === "on";
  const displayOrder = parseInt((formData.get("display_order") as string) || "0", 10);

  if (!name) {
    redirect(`/admin/servicios/${serviceId}?error=` + encodeURIComponent("El nombre es obligatorio"));
  }

  const { error } = await admin
    .from("service_types")
    .update({
      name,
      description,
      icon,
      is_active: isActive,
      display_order: displayOrder,
    })
    .eq("id", serviceId);

  if (error) {
    redirect(`/admin/servicios/${serviceId}?error=` + encodeURIComponent("Error: " + error.message));
  }
  redirect(`/admin/servicios/${serviceId}?saved=1`);
}

async function deleteService(serviceId: string) {
  "use server";
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { count: reqCount } = await admin
    .from("certificate_requests")
    .select("id", { count: "exact", head: true })
    .eq("service_type_id", serviceId);

  if (reqCount && reqCount > 0) {
    redirect(
      `/admin/servicios/${serviceId}?error=` +
        encodeURIComponent(
          `No se puede eliminar: tiene ${reqCount} solicitud${reqCount === 1 ? "" : "es"} asociada${reqCount === 1 ? "" : "s"}. Considera desactivarlo en su lugar.`,
        ),
    );
  }

  // Borrar el servicio (los form_schemas se borran en cascada)
  const { error } = await admin.from("service_types").delete().eq("id", serviceId);

  if (error) {
    redirect(`/admin/servicios/${serviceId}?error=` + encodeURIComponent("Error: " + error.message));
  }
  redirect("/admin/servicios?deleted=1");
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}

export default async function EditarServicioPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { saved, error } = await searchParams;

  const service = await getServiceById(id);
  if (!service) notFound();

  const updateBound = updateService.bind(null, id);
  const deleteBound = deleteService.bind(null, id);

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
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">{service.name}</h1>
          <Button asChild>
            <Link href={`/admin/servicios/${id}/formulario`}>
              <FileText className="h-4 w-4" />
              Editar formulario
            </Link>
          </Button>
        </div>
      </div>

      {saved && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          Servicio actualizado.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del servicio</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateBound} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input id="name" name="name" required defaultValue={service.name} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Identificador</Label>
                <Input id="slug" value={service.slug} disabled className="font-mono text-xs" />
                <p className="text-xs text-muted-foreground">
                  Generado automáticamente desde el nombre, no se puede cambiar.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={2}
                  defaultValue={service.description ?? ""}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="icon">Icono</Label>
                  <Input id="icon" name="icon" defaultValue={service.icon ?? "FileText"} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_order">Orden</Label>
                  <Input
                    id="display_order"
                    name="display_order"
                    type="number"
                    defaultValue={service.display_order}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  defaultChecked={service.is_active}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Servicio activo (los clientes pueden solicitarlo)
                </Label>
              </div>

              <SubmitButton size="sm" pendingText="Guardando...">
                Guardar cambios
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Zona peligrosa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Eliminar este servicio. Solo posible si no tiene solicitudes asociadas. Si tiene solicitudes,
              desactívalo en su lugar.
            </p>
            <form action={deleteBound}>
              <SubmitButton variant="destructive" size="sm" pendingText="Eliminando...">
                <Trash2 className="h-4 w-4" />
                Eliminar servicio
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
