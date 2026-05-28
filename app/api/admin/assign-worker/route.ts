import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  requestId: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
});

// POST /api/admin/assign-worker
// Asigna un trabajador (admin o superadmin) a una solicitud.
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
  const { requestId, assignedTo } = parsed.data;

  // Si se asigna a alguien, verificar que es admin o superadmin
  if (assignedTo) {
    const admin = createSupabaseAdminClient();
    const { data: workerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", assignedTo)
      .single();

    if (!workerProfile || (workerProfile.role !== "admin" && workerProfile.role !== "superadmin")) {
      return NextResponse.json(
        { ok: false, error: "El trabajador debe ser admin o superadmin" },
        { status: 400 },
      );
    }
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("certificate_requests")
    .update({ assigned_to: assignedTo })
    .eq("id", requestId);

  if (error) {
    console.error("[assign-worker]", error);
    return NextResponse.json({ ok: false, error: "No se pudo asignar el trabajador" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
