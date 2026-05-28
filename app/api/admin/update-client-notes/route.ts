import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  requestId: z.string().uuid(),
  clientNotes: z.string().max(5000).optional().default(""),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }
    const { requestId, clientNotes } = parsed.data;

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

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient
      .from("certificate_requests")
      .update({ client_notes: clientNotes || null })
      .eq("id", requestId);

    if (error) {
      console.error("[update-client-notes]", error);
      return NextResponse.json({ ok: false, error: "No se pudieron guardar las notas" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[update-client-notes]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
