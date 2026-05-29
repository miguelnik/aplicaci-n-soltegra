import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { getActiveServices } from "@/lib/services";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, CheckCircle2, ChevronRight, FileUp, MessageSquareText } from "lucide-react";

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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary">
            Volver al inicio
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Nueva solicitud</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Elige el servicio que necesitas. Después te pediremos la información mínima para que el equipo pueda revisar tu caso.
          </p>
        </div>
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="space-y-3 p-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              <span>Guardarás borrador si necesitas parar.</span>
            </div>
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-accent" />
              <span>Podrás adjuntar fotos o documentos.</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-accent" />
              <span>Soltegra te responderá desde el portal.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <Link key={s.id} href={`/solicitudes/nueva/${s.slug}`}>
            <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex h-full items-start gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.name}</p>
                  {s.description && (
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>
                  )}
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Empezar <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
