import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/leads/inbound
//
// Endpoint público para recibir leads desde la web pública (soltegra.es) y
// crearlos automáticamente como contacto + oportunidad + interacción en el CRM.
//
// Auth: bearer token compartido (INBOUND_LEAD_SECRET).
// Idempotencia: source_submission_id (id de la submission de Payload en la web).
// ─────────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
  submissionId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().max(50).optional().nullable(),
  subject: z.string().max(300).optional().nullable(),
  message: z.string().max(10000),
  sourcePage: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const secret = process.env.INBOUND_LEAD_SECRET;
  if (!secret) {
    console.error("[leads/inbound] INBOUND_LEAD_SECRET no configurado");
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!provided || provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const lead = parsed.data;
  const admin = createSupabaseAdminClient();

  // 1. Idempotencia: si ya hay una oportunidad creada para esta submission, devuelve la existente.
  const { data: existing } = await admin
    .from("crm_opportunities")
    .select("id, contact_id")
    .eq("source_submission_id", lead.submissionId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      opportunityId: existing.id,
      contactId: existing.contact_id,
      deduped: true,
    });
  }

  // 2. Contacto: dedupe por email (case-insensitive).
  const emailLc = lead.email.trim().toLowerCase();
  const { data: existingContact } = await admin
    .from("crm_contacts")
    .select("id, phone, full_name")
    .ilike("email", emailLc)
    .limit(1)
    .maybeSingle();

  let contactId: string;
  if (existingContact) {
    contactId = existingContact.id;
    // Si el contacto existía sin teléfono y el lead trae uno, lo completamos.
    if (!existingContact.phone && lead.phone?.trim()) {
      await admin
        .from("crm_contacts")
        .update({ phone: lead.phone.trim() })
        .eq("id", existingContact.id);
    }
  } else {
    const { data: created, error: contactErr } = await admin
      .from("crm_contacts")
      .insert({
        full_name: lead.name.trim(),
        email: emailLc,
        phone: lead.phone?.trim() || null,
        owner_id: null,
        source: "web_form",
        notes: lead.sourcePage ? `Lead recibido desde ${lead.sourcePage}` : "Lead recibido desde la web",
      })
      .select("id")
      .single();

    if (contactErr || !created) {
      console.error("[leads/inbound] error creando contacto", contactErr);
      return NextResponse.json(
        { ok: false, error: "No se pudo crear el contacto" },
        { status: 500 },
      );
    }
    contactId = created.id;
  }

  // 3. Oportunidad: una nueva por submission, en stage "contacted" (primer stage activo).
  const title = lead.subject?.trim()
    ? `Web: ${lead.subject.trim()}`
    : `Lead web — ${lead.name.trim()}`;

  const notesParts = [
    lead.sourcePage ? `Origen: ${lead.sourcePage}` : null,
    lead.subject?.trim() ? `Asunto: ${lead.subject.trim()}` : null,
    `Mensaje:\n${lead.message.trim()}`,
  ].filter(Boolean);

  const { data: opp, error: oppErr } = await admin
    .from("crm_opportunities")
    .insert({
      title,
      contact_id: contactId,
      organization_id: null,
      owner_id: null,
      stage: "contacted",
      service_type_id: null,
      notes: notesParts.join("\n\n"),
      source: "web_form",
      source_submission_id: lead.submissionId,
    })
    .select("id")
    .single();

  if (oppErr || !opp) {
    // Carrera: otra petición la creó entre el check inicial y el insert.
    if (oppErr?.code === "23505") {
      const { data: race } = await admin
        .from("crm_opportunities")
        .select("id")
        .eq("source_submission_id", lead.submissionId)
        .maybeSingle();
      if (race) {
        return NextResponse.json({
          ok: true,
          opportunityId: race.id,
          contactId,
          deduped: true,
        });
      }
    }
    console.error("[leads/inbound] error creando oportunidad", oppErr);
    return NextResponse.json(
      { ok: false, error: "No se pudo crear la oportunidad" },
      { status: 500 },
    );
  }

  // 4. Interacción inbound con el mensaje original.
  await admin.from("crm_interactions").insert({
    contact_id: contactId,
    opportunity_id: opp.id,
    kind: "note",
    direction: "inbound",
    subject: lead.subject?.trim() || "Formulario web",
    summary: lead.message.trim(),
    created_by: null,
  });

  return NextResponse.json({
    ok: true,
    opportunityId: opp.id,
    contactId,
    deduped: false,
  });
}
