import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  serviceId: z.string().uuid(),
  phases: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        label: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
      }),
    )
    .max(50),
});

// POST /api/admin/service-phases
// Guarda las fases configuradas de un tipo de servicio.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }
  const { serviceId, phases } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("service_types")
    .update({ status_phases: phases })
    .eq("id", serviceId);

  if (error) {
    console.error("[service-phases]", error);
    return NextResponse.json({ ok: false, error: "No se pudieron guardar las fases" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
