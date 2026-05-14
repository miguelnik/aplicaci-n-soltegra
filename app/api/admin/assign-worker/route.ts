import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const body = await request.json();
  const { requestId, assignedTo } = body as {
    requestId: string;
    assignedTo: string | null;
  };

  if (!requestId) {
    return NextResponse.json({ ok: false, error: "Falta requestId" }, { status: 400 });
  }

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
    .update({ assigned_to: assignedTo ?? null })
    .eq("id", requestId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
