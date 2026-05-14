import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, clientNotes } = body as {
      requestId: string;
      clientNotes: string;
    };

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
      return NextResponse.json({ ok: false, error: `DB: ${error.message}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
