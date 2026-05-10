import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAllServices } from "@/lib/services";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, PlusCircle, Settings, FileText } from "lucide-react";

export default async function AdminServiciosPage() {
  await requireAdmin();
  const services = await getAllServices();

  // Para mostrar contador de solicitudes por servicio
  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase
    .from("certificate_requests")
    .select("service_type_id");

  const requestCounts = new Map<string, number>();
  (requests ?? []).forEach((r: { service_type_id: string | null }) => {
    if (r.service_type_id) {
      requestCounts.set(r.service_type_id, (requestCounts.get(r.service_type_id) ?? 0) + 1);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Tipos de proyectos que tus clientes pueden solicitar. Cada uno tiene su formulario propio.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/servicios/nuevo">
            <PlusCircle className="h-4 w-4" />
            Nuevo servicio
          </Link>
        </Button>
      </div>

      {services.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const count = requestCounts.get(s.id) ?? 0;
            return (
              <Card key={s.id} className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Briefcase className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{s.name}</p>
                        {!s.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{s.slug}</p>
                    </div>
                  </div>
                  {s.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {count} solicitud{count !== 1 ? "es" : ""}
                  </p>
                  <div className="flex gap-2 border-t pt-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/admin/servicios/${s.id}`}>
                        <Settings className="h-3.5 w-3.5" />
                        Editar
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/admin/servicios/${s.id}/formulario`}>
                        <FileText className="h-3.5 w-3.5" />
                        Formulario
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">Sin servicios todavía</p>
            <p className="text-sm text-muted-foreground">
              Crea el primer servicio para que tus clientes puedan solicitarlo.
            </p>
            <Button asChild>
              <Link href="/admin/servicios/nuevo">
                <PlusCircle className="h-4 w-4" />
                Nuevo servicio
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
