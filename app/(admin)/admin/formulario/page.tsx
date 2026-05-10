import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

// Esta ruta antigua editaba "el formulario" único. Ahora cada servicio tiene
// su propio formulario, así que redirigimos al listado de servicios.
export default async function FormularioPage() {
  await requireAdmin();
  redirect("/admin/servicios");
}
