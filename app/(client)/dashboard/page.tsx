import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import { PlusCircle, FileText, Download } from "lucide-react";

const STATUS_STEPS = [
  "submitted",
  "in_review",
  "in_progress",
  "delivered",
] as const;

function ProgressBar({ status }: { status: string }) {
  const stepIndex = STATUS_STEPS.indexOf(status as never);
  const progress = stepIndex === -1 ? 0 : ((stepIndex + 1) / STATUS_STEPS.length) * 100;

  return (
    <div className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Enviada</span>
        <span>En revisión</span>
        <span>En redacción</span>
        <span>Entregado</span>
      </div>
    </div>
  );
}

export default async function ClientDashboardPage() {
  const profile = await requireClient();
  const supabase = await createSupabaseServerClient();

  // Última solicitud no cancelada y no borrador
  const { data: lastRequest } = await supabase
    .from("certificate_requests")
    .select("id, status, property_address, reference_code, estimated_delivery_date, delivered_at, certificate_pdf_path")
    .eq("organization_id", profile.organization_id!)
    .not("status", "in", '("draft","cancelled")')
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Todas las solicitudes para el listado
  const { data: allRequests } = await supabase
    .from("certificate_requests")
    .select("id, status, property_address, reference_code, estimated_delivery_date, created_at, certificate_pdf_path")
    .eq("organization_id", profile.organization_id!)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bienvenido{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
          <p className="text-muted-foreground">Gestiona tus certificados energéticos</p>
        </div>
        <Button asChild>
          <Link href="/solicitudes/nueva">
            <PlusCircle className="h-4 w-4" />
            Nueva solicitud
          </Link>
        </Button>
      </div>

      {/* Tarjeta del certificado más reciente */}
      {lastRequest ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">Certificado en curso</CardTitle>
                <CardDescription>{lastRequest.property_address ?? "Sin dirección"}</CardDescription>
              </div>
              <StatusBadge status={lastRequest.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastRequest.status !== "delivered" && lastRequest.status !== "cancelled" && (
              <ProgressBar status={lastRequest.status} />
            )}
            {lastRequest.estimated_delivery_date && lastRequest.status !== "delivered" && (
              <p className="text-sm text-muted-foreground">
                Entrega prevista:{" "}
                <span className="font-medium text-foreground">
                  {format(new Date(lastRequest.estimated_delivery_date), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </span>
              </p>
            )}
            {lastRequest.status === "delivered" && lastRequest.certificate_pdf_path && (
              <Button size="sm" asChild>
                <Link href={`/solicitudes/${lastRequest.id}/descargar`}>
                  <Download className="h-4 w-4" />
                  Descargar certificado
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">Sin certificados activos</p>
              <p className="text-sm text-muted-foreground">
                Crea tu primera solicitud para empezar
              </p>
            </div>
            <Button asChild>
              <Link href="/solicitudes/nueva">
                <PlusCircle className="h-4 w-4" />
                Nueva solicitud
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Historial */}
      {allRequests && allRequests.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Historial</h2>
          <div className="space-y-2">
            {allRequests.map((req) => (
              <Link key={req.id} href={`/solicitudes/${req.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{req.property_address ?? "Sin dirección"}</p>
                      <p className="text-xs text-muted-foreground">
                        {req.reference_code} ·{" "}
                        {format(new Date(req.created_at), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {req.status === "delivered" && req.certificate_pdf_path && (
                        <Download className="h-4 w-4 text-muted-foreground" />
                      )}
                      <StatusBadge status={req.status} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
