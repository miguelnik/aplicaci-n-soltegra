// GET /api/ai/client-intel/history?opportunityId=xxx&organizationId=yyy
// Devuelve el análisis más reciente y su historial de chat para una
// oportunidad o contacto/organización.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const opportunityId = url.searchParams.get("opportunityId");
  const organizationId = url.searchParams.get("organizationId");

  if (!opportunityId && !organizationId) {
    return NextResponse.json({ error: "Falta opportunityId u organizationId" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Buscar el análisis más reciente para esta oportunidad u organización
  let query = admin
    .from("ai_client_analyses")
    .select("id, client_context, client_website, analysis_result, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  if (opportunityId) {
    query = query.eq("opportunity_id", opportunityId);
  } else {
    query = query.eq("organization_id", organizationId!);
  }

  const { data: analysis } = await query.maybeSingle();

  if (!analysis) {
    return NextResponse.json({ analysis: null, messages: [] });
  }

  // Cargar mensajes del análisis
  const { data: msgs } = await admin
    .from("ai_client_chat_messages")
    .select("role, content")
    .eq("analysis_id", analysis.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    analysis: {
      id: analysis.id,
      clientContext: analysis.client_context,
      clientWebsite: analysis.client_website,
      analysisResult: analysis.analysis_result,
      createdAt: analysis.created_at,
    },
    messages: (msgs ?? [])
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content })),
  });
}
