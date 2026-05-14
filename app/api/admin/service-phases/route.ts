import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const body = await request.json();
  const { serviceId, phases } = body as {
    serviceId: string;
    phases: Array<{ key: string; label: string; description?: string }>;
  };

  if (!serviceId || !Array.isArray(phases)) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  // Validar que cada fase tenga key y label
  for (const phase of phases) {
    if (!phase.key || !phase.label) {
      return NextResponse.json(
        { ok: false, error: "Cada fase debe tener clave y nombre" },
        { status: 400 },
      );
    }
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("service_types")
    .update({ status_phases: phases })
    .eq("id", serviceId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
