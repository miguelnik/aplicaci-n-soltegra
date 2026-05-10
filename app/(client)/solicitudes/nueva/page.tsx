import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { getActiveServices } from "@/lib/services";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, ChevronRight } from "lucide-react";

export default async function NuevaSolicitudPickerPage() {
  await requireClient();
  const services = await getActiveServices();

  if (services.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-muted-foreground">
        No hay servicios disponibles. Contacta con Soltegra.
      </div>
    );
  }

  // Si solo hay un servicio, redirigir directo (UX mejor — no hay que elegir)
  if (services.length === 1) {
    const { redirect } = await import("next/navigation");
    redirect(`/solicitudes/nueva/${services[0].slug}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nueva solicitud</h1>
        <p className="text-muted-foreground">
          Elige el tipo de servicio que necesitas.
        </p>
      </div>

      <div className="space-y-2">
        {services.map((s) => (
          <Link key={s.id} href={`/solicitudes/nueva/${s.slug}`}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.name}</p>
                  {s.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">{s.description}</p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
