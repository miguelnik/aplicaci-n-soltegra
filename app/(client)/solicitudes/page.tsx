import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/client/StatusBadge";
import { format } from "date-fns";
import { Download, PlusCircle } from "lucide-react";

export default async function SolicitudesPage() {
  const profile = await requireClient();
  const supabase = await createSupabaseServerClient();

  const { data: requests } = await supabase
    .from("certificate_requests")
    .select("id, status, property_address, reference_code, estimated_delivery_date, created_at, certificate_pdf_path")
    .eq("organization_id", profile.organization_id!)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis certificados</h1>
        <Button asChild>
          <Link href="/solicitudes/nueva">
            <PlusCircle className="h-4 w-4" />
            Nueva solicitud
          </Link>
        </Button>
      </div>

      {requests && requests.length > 0 ? (
        <div className="space-y-2">
          {requests.map((req) => (
            <Link key={req.id} href={`/solicitudes/${req.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="space-y-0.5">
                    <p className="font-medium">{req.property_address ?? "Sin dirección"}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.reference_code ?? "Sin referencia"} ·{" "}
                      {format(new Date(req.created_at), "dd/MM/yyyy")}
                    </p>
                    {req.estimated_delivery_date && req.status !== "delivered" && (
                      <p className="text-xs text-muted-foreground">
                        Entrega prevista: {format(new Date(req.estimated_delivery_date), "dd/MM/yyyy")}
                      </p>
                    )}
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
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Sin solicitudes todavía.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
