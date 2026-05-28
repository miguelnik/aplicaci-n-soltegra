"use server";

// ============================================================================
// Server Actions del CRM.
// CRUD de contactos, oportunidades e interacciones. Todas requieren admin.
// ============================================================================

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { autoLinkContactOnConversion } from "./client-sync";
import type {
  OpportunityStage, InteractionKind, InteractionDirection,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// CONTACTOS
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateContactInput {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  organizationId?: string | null;
  companyName?: string | null;
  notes?: string | null;
  ownerId?: string | null;
}

export async function createCrmContact(
  input: CreateContactInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (!input.fullName?.trim()) return { ok: false, error: "Falta el nombre" };

    const { data, error } = await admin
      .from("crm_contacts")
      .insert({
        full_name: input.fullName.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        position: input.position?.trim() || null,
        organization_id: input.organizationId || null,
        company_name: input.companyName?.trim() || null,
        notes: input.notes?.trim() || null,
        owner_id: input.ownerId ?? me.id,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/crm/contactos");
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type UpdateContactInput = Partial<CreateContactInput>;

export async function updateCrmContact(
  id: string,
  input: UpdateContactInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    const payload: Record<string, unknown> = {};
    if (input.fullName !== undefined) payload.full_name = input.fullName.trim();
    if (input.email !== undefined) payload.email = input.email?.trim() || null;
    if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
    if (input.position !== undefined) payload.position = input.position?.trim() || null;
    if (input.organizationId !== undefined) payload.organization_id = input.organizationId || null;
    if (input.companyName !== undefined) payload.company_name = input.companyName?.trim() || null;
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
    if (input.ownerId !== undefined) payload.owner_id = input.ownerId;

    if (Object.keys(payload).length === 0) return { ok: false, error: "Sin campos a actualizar" };

    const { error } = await admin.from("crm_contacts").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/admin/crm/contactos/${id}`);
    revalidatePath("/admin/crm/contactos");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteCrmContact(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("crm_contacts").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/crm/contactos");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPORTUNIDADES
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateOpportunityInput {
  title: string;
  contactId?: string | null;
  organizationId?: string | null;
  ownerId?: string | null;
  stage?: OpportunityStage;
  serviceTypeId?: string | null;
  estimatedValue?: number | null;
  expectedCloseDate?: string | null;
  probability?: number | null;
  nextAction?: string | null;
  nextActionDue?: string | null;
  notes?: string | null;
}

export async function createCrmOpportunity(
  input: CreateOpportunityInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (!input.title?.trim()) return { ok: false, error: "Falta el título" };

    const { data, error } = await admin
      .from("crm_opportunities")
      .insert({
        title: input.title.trim(),
        contact_id: input.contactId || null,
        organization_id: input.organizationId || null,
        owner_id: input.ownerId ?? me.id,
        stage: input.stage ?? "contacted",
        service_type_id: input.serviceTypeId || null,
        estimated_value: input.estimatedValue ?? null,
        expected_close_date: input.expectedCloseDate || null,
        probability: input.probability ?? null,
        next_action: input.nextAction?.trim() || null,
        next_action_due: input.nextActionDue || null,
        notes: input.notes?.trim() || null,
        created_by: me.id,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/crm");
    revalidatePath("/admin/crm/oportunidades");
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface UpdateOpportunityInput extends Partial<CreateOpportunityInput> {
  lostReason?: string | null;
}

export async function updateCrmOpportunity(
  id: string,
  input: UpdateOpportunityInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.contactId !== undefined) payload.contact_id = input.contactId || null;
    if (input.organizationId !== undefined) payload.organization_id = input.organizationId || null;
    if (input.ownerId !== undefined) payload.owner_id = input.ownerId;
    if (input.stage !== undefined) payload.stage = input.stage;
    if (input.serviceTypeId !== undefined) payload.service_type_id = input.serviceTypeId || null;
    if (input.estimatedValue !== undefined) payload.estimated_value = input.estimatedValue;
    if (input.expectedCloseDate !== undefined) payload.expected_close_date = input.expectedCloseDate || null;
    if (input.probability !== undefined) payload.probability = input.probability;
    if (input.nextAction !== undefined) payload.next_action = input.nextAction?.trim() || null;
    if (input.nextActionDue !== undefined) payload.next_action_due = input.nextActionDue || null;
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
    if (input.lostReason !== undefined) payload.lost_reason = input.lostReason?.trim() || null;

    if (Object.keys(payload).length === 0) return { ok: false, error: "Sin cambios" };

    const { error } = await admin.from("crm_opportunities").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/crm");
    revalidatePath(`/admin/crm/oportunidades/${id}`);
    revalidatePath("/admin/crm/oportunidades");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setOpportunityStage(
  id: string,
  stage: OpportunityStage,
): Promise<{ ok: boolean; error?: string }> {
  return updateCrmOpportunity(id, { stage });
}

export async function deleteCrmOpportunity(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("crm_opportunities").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/crm");
    revalidatePath("/admin/crm/oportunidades");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACCIONES (comunicaciones)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateInteractionInput {
  contactId?: string | null;
  opportunityId?: string | null;
  kind: InteractionKind;
  happenedAt?: string;            // ISO datetime, default now
  subject?: string | null;
  summary?: string | null;
  direction?: InteractionDirection | null;
}

export async function createCrmInteraction(
  input: CreateInteractionInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (!input.contactId && !input.opportunityId) {
      return { ok: false, error: "La interacción debe ir asociada a un contacto o a una oportunidad" };
    }
    if (!input.kind) return { ok: false, error: "Falta el tipo" };

    const { data, error } = await admin
      .from("crm_interactions")
      .insert({
        contact_id: input.contactId || null,
        opportunity_id: input.opportunityId || null,
        kind: input.kind,
        happened_at: input.happenedAt || new Date().toISOString(),
        subject: input.subject?.trim() || null,
        summary: input.summary?.trim() || null,
        direction: input.direction || null,
        created_by: me.id,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    if (input.contactId)     revalidatePath(`/admin/crm/contactos/${input.contactId}`);
    if (input.opportunityId) revalidatePath(`/admin/crm/oportunidades/${input.opportunityId}`);
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteCrmInteraction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("crm_interactions").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERTIR OPORTUNIDAD GANADA → PROYECTO (certificate_request)
// ─────────────────────────────────────────────────────────────────────────────

export async function convertOpportunityToProject(
  opportunityId: string,
  serviceTypeId: string,
  propertyAddress: string,
): Promise<{ ok: boolean; requestId?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    // Cargar la oportunidad
    const { data: opp, error: oppErr } = await admin
      .from("crm_opportunities")
      .select("*")
      .eq("id", opportunityId)
      .single();
    if (oppErr || !opp) return { ok: false, error: "Oportunidad no encontrada" };

    if (!opp.organization_id) {
      return { ok: false, error: "La oportunidad debe tener un cliente (organización) asignado para convertirla en proyecto" };
    }
    if (!propertyAddress.trim()) return { ok: false, error: "Falta el nombre/dirección del proyecto" };

    // Buscar el form schema actual del servicio
    const { data: schema } = await admin
      .from("form_schemas")
      .select("id")
      .eq("service_type_id", serviceTypeId)
      .eq("is_current", true)
      .maybeSingle();

    if (!schema) {
      return { ok: false, error: "Este servicio no tiene un formulario configurado. Edítalo desde Servicios → Editar formulario." };
    }

    // Primera fase si las hay
    const { data: svc } = await admin
      .from("service_types")
      .select("status_phases")
      .eq("id", serviceTypeId)
      .single();
    const phases = (svc?.status_phases as Array<{ key: string }> | null) ?? [];

    const now = new Date().toISOString();
    const { data: created, error: createErr } = await admin
      .from("certificate_requests")
      .insert({
        organization_id: opp.organization_id,
        service_type_id: serviceTypeId,
        form_schema_id: schema.id,
        form_data: {},
        status: "submitted",
        status_history: [{ status: "submitted", at: now }],
        property_address: propertyAddress.trim(),
        price: opp.estimated_value,
        is_hidden_from_client: false,
        current_phase_key: phases.length > 0 ? phases[0].key : null,
        created_by: me.id,
        is_paid: false,
      })
      .select("id")
      .single();

    if (createErr) return { ok: false, error: createErr.message };

    // Marcar la oportunidad como ganada y guardar la referencia al proyecto
    await admin
      .from("crm_opportunities")
      .update({
        stage: "won",
        converted_to_request_id: created.id,
      })
      .eq("id", opportunityId);

    // Auto-link del contacto a la organización (y como cliente si tiene email)
    try {
      await autoLinkContactOnConversion(opp.contact_id, opp.organization_id);
    } catch {
      // No bloqueamos la conversión por esto
    }

    revalidatePath("/admin/crm");
    revalidatePath(`/admin/crm/oportunidades/${opportunityId}`);
    revalidatePath("/admin/solicitudes");

    return { ok: true, requestId: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
