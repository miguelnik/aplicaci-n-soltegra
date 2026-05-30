// POST /api/ai/client-intel
// SSE streaming para análisis de inteligencia de cliente.
// Accesible para todos los admins.

import { z } from "zod";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAiClientAndModel, createAiStream } from "@/lib/ai/openai";
import { clientIntelligencePrompt } from "@/lib/ai/prompts";
import { fetchWebsiteContent } from "@/lib/ai/web-scraper";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const BodySchema = z.object({
  opportunityId: z.string().uuid().nullable().optional(),
  organizationId: z.string().uuid().nullable().optional(),
  clientContext: z.string().min(1).max(10000),
  clientWebsite: z.string().max(500).nullable().optional(),
  message: z.string().min(1).max(10000).optional(),
  analysisId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
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

  // ── Validar body ───────────────────────────────────────────────────────
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { opportunityId, organizationId, clientContext, clientWebsite, message, analysisId } = parsed.data;

  // ── OpenAI client ──────────────────────────────────────────────────────
  const ai = await getAiClientAndModel();
  if (!ai) {
    return NextResponse.json(
      { error: "No hay API key de OpenAI configurada." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();

  // ── Cargar contexto ────────────────────────────────────────────────────
  const { data: kb } = await admin
    .from("ai_knowledge_base")
    .select("content")
    .limit(1)
    .maybeSingle();

  const { data: company } = await admin
    .from("company_settings")
    .select("legal_name")
    .limit(1)
    .maybeSingle();

  const { data: services } = await admin
    .from("service_types")
    .select("name, description")
    .order("name");

  const companyName = company?.legal_name ?? "la empresa";
  const kbContent = kb?.content ?? "";
  const servicesCatalog = (services ?? [])
    .map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ""}`)
    .join("\n");

  // Datos del cliente / organización
  let clientInfo = clientContext;
  if (organizationId) {
    const { data: org } = await admin
      .from("organizations")
      .select("name, cif, contact_email, contact_phone, billing_address")
      .eq("id", organizationId)
      .single();
    if (org) {
      clientInfo += `\n\nOrganización: ${org.name}`;
      if (org.cif) clientInfo += ` (CIF: ${org.cif})`;
      if (org.contact_email) clientInfo += `\nEmail: ${org.contact_email}`;
      if (org.contact_phone) clientInfo += `\nTeléfono: ${org.contact_phone}`;
      if (org.billing_address) clientInfo += `\nDirección: ${org.billing_address}`;
    }
  }

  // Datos de la oportunidad
  let opportunityData: string | null = null;
  if (opportunityId) {
    const { data: opp } = await admin
      .from("crm_opportunities")
      .select(`
        title, stage, estimated_value, expected_close_date, probability,
        next_action, notes,
        service_types:service_type_id ( name )
      `)
      .eq("id", opportunityId)
      .single();
    if (opp) {
      const parts = [`Título: ${opp.title}`, `Etapa: ${opp.stage}`];
      const svc = opp.service_types as unknown as { name: string } | null;
      if (svc) parts.push(`Servicio: ${svc.name}`);
      if (opp.estimated_value) parts.push(`Valor estimado: ${opp.estimated_value}€`);
      if (opp.probability) parts.push(`Probabilidad: ${opp.probability}%`);
      if (opp.expected_close_date) parts.push(`Cierre esperado: ${opp.expected_close_date}`);
      if (opp.next_action) parts.push(`Próxima acción: ${opp.next_action}`);
      if (opp.notes) parts.push(`Notas: ${opp.notes}`);
      opportunityData = parts.join("\n");
    }
  }

  // Interacciones recientes
  let interactions: string | null = null;
  const contactOrOrgFilter = opportunityId
    ? { column: "opportunity_id", value: opportunityId }
    : organizationId
      ? null // buscar por contactos de la org
      : null;

  if (contactOrOrgFilter) {
    const { data: ints } = await admin
      .from("crm_interactions")
      .select("kind, happened_at, subject, summary")
      .eq(contactOrOrgFilter.column, contactOrOrgFilter.value)
      .order("happened_at", { ascending: false })
      .limit(10);

    if (ints && ints.length > 0) {
      interactions = ints
        .map((i) =>
          `[${i.kind}] ${i.happened_at}: ${i.subject ?? ""}${i.summary ? ` — ${i.summary}` : ""}`
        )
        .join("\n");
    }
  }

  // Contenido de la web del cliente
  let websiteContent: string | null = null;
  if (clientWebsite?.trim()) {
    websiteContent = await fetchWebsiteContent(clientWebsite.trim());
  }

  // ── Historial del análisis (follow-up chat) ────────────────────────────
  let chatHistory: ChatCompletionMessageParam[] = [];
  let currentAnalysisId = analysisId;

  if (currentAnalysisId) {
    const { data: prevMsgs } = await admin
      .from("ai_client_chat_messages")
      .select("role, content")
      .eq("analysis_id", currentAnalysisId)
      .order("created_at", { ascending: true })
      .limit(20);

    chatHistory = (prevMsgs ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  } else {
    // Crear nuevo análisis
    const { data: newAnalysis } = await admin
      .from("ai_client_analyses")
      .insert({
        opportunity_id: opportunityId ?? null,
        organization_id: organizationId ?? null,
        client_context: clientContext,
        client_website: clientWebsite ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();

    currentAnalysisId = newAnalysis?.id ?? null;
  }

  // ── Construir mensajes ─────────────────────────────────────────────────
  const systemPrompt = clientIntelligencePrompt(
    companyName,
    kbContent,
    servicesCatalog,
    clientInfo,
    websiteContent,
    opportunityData,
    interactions,
  );

  const userMessage = message ?? "Analiza este cliente y dame tu recomendación comercial.";

  const messages2: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...chatHistory,
    { role: "user", content: userMessage },
  ];

  // Guardar mensaje del usuario
  if (currentAnalysisId) {
    await admin.from("ai_client_chat_messages").insert({
      analysis_id: currentAnalysisId,
      role: "user",
      content: userMessage,
    });
  }

  // ── Stream ─────────────────────────────────────────────────────────────
  const finalAnalysisId = currentAnalysisId;
  return createAiStream({
    messages: messages2,
    client: ai.client,
    model: ai.model,
    onComplete: async (fullResponse) => {
      if (finalAnalysisId) {
        // Guardar respuesta
        await admin.from("ai_client_chat_messages").insert({
          analysis_id: finalAnalysisId,
          role: "assistant",
          content: fullResponse,
        });

        // Guardar resultado del análisis
        await admin
          .from("ai_client_analyses")
          .update({ analysis_result: fullResponse })
          .eq("id", finalAnalysisId);
      }
    },
  });
}
