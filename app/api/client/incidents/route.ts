import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  requestId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

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

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }
    const { requestId, title, description, severity } = parsed.data;

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
        title: title.trim(),
        description: description.trim() || null,
        severity,
        status: "open",
        is_visible_to_client: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[client/incidents]", error);
      return NextResponse.json({ ok: false, error: "No se pudo crear la incidencia" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[client/incidents]", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
