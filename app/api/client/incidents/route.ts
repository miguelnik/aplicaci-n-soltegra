import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_SEVERITIES = ["low", "medium", "high", "critical"];

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "client") {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const requestId = body?.requestId as string | undefined;
    const title = (body?.title ?? "").trim();
    const description = (body?.description ?? "").trim();
    const severity = VALID_SEVERITIES.includes(body?.severity) ? body.severity : "medium";

    if (!requestId || !title) {
      return NextResponse.json({ ok: false, error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const { data: req } = await supabase
      .from("certificate_requests")
      .select("id")
      .eq("id", requestId)
      .eq("organization_id", profile.organization_id!)
      .single();

    if (!req) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("expedition_incidents")
      .insert({
        request_id: requestId,
        title,
        description: description || null,
        severity,
        status: "open",
        is_visible_to_client: true,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
