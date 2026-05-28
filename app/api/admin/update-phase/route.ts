import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  requestId: z.string().uuid(),
  phaseKey: z.string().min(1).max(100).nullable(),
});

// POST /api/admin/update-phase
// Actualiza la fase actual de una solicitud.
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
  const { requestId, phaseKey } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("certificate_requests")
    .update({ current_phase_key: phaseKey })
    .eq("id", requestId);

  if (error) {
    console.error("[update-phase]", error);
    return NextResponse.json({ ok: false, error: "No se pudo actualizar la fase" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
