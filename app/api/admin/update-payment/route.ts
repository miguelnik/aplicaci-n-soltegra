import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  requestIds: z.array(z.string().uuid()).min(1).max(500),
  isPaid: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }
    const { requestIds, isPaid } = parsed.data;

    // Verificar que es admin
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    // Usar admin client para actualizar (bypassa RLS)
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient
      .from("certificate_requests")
      .update({
        is_paid: isPaid,
        paid_at: isPaid ? new Date().toISOString() : null,
      })
      .in("id", requestIds);

    if (error) {
      console.error("[update-payment]", error);
      return NextResponse.json(
        { ok: false, error: "No se pudo actualizar el estado de pago" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, count: requestIds.length });
  } catch (err) {
    console.error("[update-payment]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
