"use server";

// ============================================================================
// Server actions de presupuestos, plantillas y ajustes de empresa.
// ============================================================================

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BudgetStatus, BudgetItem, BudgetTemplateItem } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY SETTINGS (sólo superadmin edita)
// ─────────────────────────────────────────────────────────────────────────────

export interface UpdateCompanyInput {
  legalName?: string;
  tradeName?: string | null;
  cif?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  iban?: string | null;
  paymentTerms?: string | null;
  legalNotes?: string | null;
  defaultVat?: number;
  budgetPrefix?: string;
}

export async function updateCompanySettings(
  input: UpdateCompanyInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
    const admin = createSupabaseAdminClient();

    // Cargar la fila singleton
    const { data: existing } = await admin.from("company_settings").select("id").limit(1).maybeSingle();
    if (!existing) return { ok: false, error: "No hay fila inicial de company_settings (ejecuta la migración)" };

    const payload: Record<string, unknown> = {};
    if (input.legalName !== undefined && input.legalName.trim()) payload.legal_name = input.legalName.trim();
    if (input.tradeName !== undefined) payload.trade_name = input.tradeName?.trim() || null;
    if (input.cif !== undefined) payload.cif = input.cif?.trim() || null;
    if (input.addressLine1 !== undefined) payload.address_line1 = input.addressLine1?.trim() || null;
    if (input.addressLine2 !== undefined) payload.address_line2 = input.addressLine2?.trim() || null;
    if (input.postalCode !== undefined) payload.postal_code = input.postalCode?.trim() || null;
    if (input.city !== undefined) payload.city = input.city?.trim() || null;
    if (input.province !== undefined) payload.province = input.province?.trim() || null;
    if (input.country !== undefined) payload.country = input.country?.trim() || null;
    if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
    if (input.email !== undefined) payload.email = input.email?.trim() || null;
    if (input.website !== undefined) payload.website = input.website?.trim() || null;
    if (input.iban !== undefined) payload.iban = input.iban?.trim() || null;
    if (input.paymentTerms !== undefined) payload.payment_terms = input.paymentTerms?.trim() || null;
    if (input.legalNotes !== undefined) payload.legal_notes = input.legalNotes?.trim() || null;
    if (input.defaultVat !== undefined) payload.default_vat = input.defaultVat;
    if (input.budgetPrefix !== undefined && input.budgetPrefix.trim()) payload.budget_prefix = input.budgetPrefix.trim();

    if (Object.keys(payload).length === 0) return { ok: false, error: "Sin cambios" };

    const { error } = await admin.from("company_settings").update(payload).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/ajustes/empresa");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANTILLAS
// ─────────────────────────────────────────────────────────────────────────────

export interface SaveTemplateInput {
  name: string;
  description?: string | null;
  serviceTypeId?: string | null;
  isActive?: boolean;
  items: Array<{
    concept: string;
    description?: string | null;
    quantity: number;
    unit?: string | null;
    unitPrice: number;
    discountPct?: number;
  }>;
}

export async function createBudgetTemplate(
  input: SaveTemplateInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (!input.name?.trim()) return { ok: false, error: "Falta el nombre de la plantilla" };

    const { data: tpl, error } = await admin
      .from("budget_templates")
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        service_type_id: input.serviceTypeId || null,
        is_active: input.isActive ?? true,
        created_by: me.id,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    if (input.items.length > 0) {
      const rows = input.items.map((it, idx) => ({
        template_id: tpl.id,
        position: idx,
        concept: it.concept.trim(),
        description: it.description?.trim() || null,
        quantity: it.quantity,
        unit: it.unit?.trim() || "ud",
        unit_price: it.unitPrice,
        discount_pct: it.discountPct ?? 0,
      }));
      const { error: itemsErr } = await admin.from("budget_template_items").insert(rows);
      if (itemsErr) return { ok: false, error: "Plantilla creada pero error en líneas: " + itemsErr.message };
    }

    revalidatePath("/admin/presupuestos/plantillas");
    return { ok: true, id: tpl.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateBudgetTemplate(
  id: string,
  input: SaveTemplateInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (!input.name?.trim()) return { ok: false, error: "Falta nombre" };

    const { error: updErr } = await admin
      .from("budget_templates")
      .update({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        service_type_id: input.serviceTypeId || null,
        is_active: input.isActive ?? true,
      })
      .eq("id", id);
    if (updErr) return { ok: false, error: updErr.message };

    // Reemplazar líneas completas
    await admin.from("budget_template_items").delete().eq("template_id", id);
    if (input.items.length > 0) {
      const rows = input.items.map((it, idx) => ({
        template_id: id,
        position: idx,
        concept: it.concept.trim(),
        description: it.description?.trim() || null,
        quantity: it.quantity,
        unit: it.unit?.trim() || "ud",
        unit_price: it.unitPrice,
        discount_pct: it.discountPct ?? 0,
      }));
      const { error: itemsErr } = await admin.from("budget_template_items").insert(rows);
      if (itemsErr) return { ok: false, error: itemsErr.message };
    }

    revalidatePath("/admin/presupuestos/plantillas");
    revalidatePath(`/admin/presupuestos/plantillas/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteBudgetTemplate(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("budget_templates").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/presupuestos/plantillas");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESUPUESTOS
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateBudgetInput {
  title: string;
  intro?: string | null;
  contactId?: string | null;
  organizationId?: string | null;
  opportunityId?: string | null;
  ownerId?: string | null;
  vatPct?: number;
  validUntil?: string | null;            // YYYY-MM-DD
  /** Si se indica, copia las líneas de esa plantilla */
  fromTemplateId?: string | null;
  /** Líneas (si no se usa plantilla, o se quieren añadir extras) */
  items?: Array<{
    concept: string;
    description?: string | null;
    quantity: number;
    unit?: string | null;
    unitPrice: number;
    discountPct?: number;
  }>;
}

export async function createBudget(
  input: CreateBudgetInput,
): Promise<{ ok: boolean; id?: string; number?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (!input.title?.trim()) return { ok: false, error: "Falta el título" };

    // Cargar datos por defecto (company + vat default + validez)
    const { data: company } = await admin.from("company_settings").select("default_vat, payment_terms, legal_notes").maybeSingle();
    const vatPct = input.vatPct ?? Number(company?.default_vat ?? 21);
    const validUntil = input.validUntil ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Capturar datos del cliente / contacto en el momento (snapshot)
    let clientLegalName: string | null = null;
    let clientCif: string | null = null;
    const clientAddress: string | null = null;
    let clientEmail: string | null = null;
    let clientPhone: string | null = null;

    if (input.organizationId) {
      const { data: org } = await admin.from("organizations").select("name, cif, contact_email, contact_phone").eq("id", input.organizationId).single();
      if (org) {
        clientLegalName = org.name;
        clientCif = org.cif;
        clientEmail = org.contact_email;
        clientPhone = org.contact_phone;
      }
    }
    if (input.contactId) {
      const { data: c } = await admin.from("crm_contacts").select("full_name, email, phone, company_name").eq("id", input.contactId).single();
      if (c) {
        if (!clientLegalName) clientLegalName = c.company_name ?? c.full_name;
        if (!clientEmail) clientEmail = c.email;
        if (!clientPhone) clientPhone = c.phone;
      }
    }

    // Crear cabecera
    const { data: budget, error: bErr } = await admin
      .from("budgets")
      .insert({
        title: input.title.trim(),
        intro: input.intro?.trim() || null,
        contact_id: input.contactId || null,
        organization_id: input.organizationId || null,
        opportunity_id: input.opportunityId || null,
        owner_id: input.ownerId ?? me.id,
        created_by: me.id,
        vat_pct: vatPct,
        valid_until: validUntil,
        client_legal_name: clientLegalName,
        client_cif: clientCif,
        client_address: clientAddress,
        client_email: clientEmail,
        client_phone: clientPhone,
        payment_terms: company?.payment_terms ?? null,
        legal_notes: company?.legal_notes ?? null,
        status: "draft",
      })
      .select("id, number")
      .single();
    if (bErr || !budget) return { ok: false, error: "Error creando presupuesto: " + (bErr?.message ?? "") };

    // Cargar líneas: plantilla + extras
    const lines: { concept: string; description: string | null; quantity: number; unit: string; unit_price: number; discount_pct: number }[] = [];

    if (input.fromTemplateId) {
      const { data: tplItems } = await admin
        .from("budget_template_items")
        .select("*")
        .eq("template_id", input.fromTemplateId)
        .order("position");
      for (const it of tplItems ?? []) {
        lines.push({
          concept: it.concept,
          description: it.description,
          quantity: Number(it.quantity),
          unit: it.unit ?? "ud",
          unit_price: Number(it.unit_price),
          discount_pct: Number(it.discount_pct),
        });
      }
    }

    for (const it of input.items ?? []) {
      lines.push({
        concept: it.concept.trim(),
        description: it.description?.trim() || null,
        quantity: it.quantity,
        unit: it.unit?.trim() || "ud",
        unit_price: it.unitPrice,
        discount_pct: it.discountPct ?? 0,
      });
    }

    if (lines.length > 0) {
      const rows = lines.map((l, idx) => ({
        budget_id: budget.id,
        position: idx,
        ...l,
      }));
      await admin.from("budget_items").insert(rows);
    }

    revalidatePath("/admin/presupuestos");
    return { ok: true, id: budget.id, number: budget.number ?? undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface UpdateBudgetInput {
  title?: string;
  intro?: string | null;
  contactId?: string | null;
  organizationId?: string | null;
  opportunityId?: string | null;
  ownerId?: string | null;
  vatPct?: number;
  validUntil?: string | null;
  issueDate?: string;
  clientLegalName?: string | null;
  clientCif?: string | null;
  clientAddress?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  paymentTerms?: string | null;
  legalNotes?: string | null;
}

export async function updateBudget(
  id: string,
  input: UpdateBudgetInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.intro !== undefined) payload.intro = input.intro?.trim() || null;
    if (input.contactId !== undefined) payload.contact_id = input.contactId || null;
    if (input.organizationId !== undefined) payload.organization_id = input.organizationId || null;
    if (input.opportunityId !== undefined) payload.opportunity_id = input.opportunityId || null;
    if (input.ownerId !== undefined) payload.owner_id = input.ownerId;
    if (input.vatPct !== undefined) payload.vat_pct = input.vatPct;
    if (input.validUntil !== undefined) payload.valid_until = input.validUntil || null;
    if (input.issueDate !== undefined) payload.issue_date = input.issueDate;
    if (input.clientLegalName !== undefined) payload.client_legal_name = input.clientLegalName?.trim() || null;
    if (input.clientCif !== undefined) payload.client_cif = input.clientCif?.trim() || null;
    if (input.clientAddress !== undefined) payload.client_address = input.clientAddress?.trim() || null;
    if (input.clientEmail !== undefined) payload.client_email = input.clientEmail?.trim() || null;
    if (input.clientPhone !== undefined) payload.client_phone = input.clientPhone?.trim() || null;
    if (input.paymentTerms !== undefined) payload.payment_terms = input.paymentTerms?.trim() || null;
    if (input.legalNotes !== undefined) payload.legal_notes = input.legalNotes?.trim() || null;

    if (Object.keys(payload).length === 0) return { ok: false, error: "Sin cambios" };

    const { error } = await admin.from("budgets").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/admin/presupuestos/${id}`);
    revalidatePath("/admin/presupuestos");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setBudgetStatus(
  id: string,
  status: BudgetStatus,
  rejectionReason?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    const payload: Record<string, unknown> = { status };
    if (status === "rejected") {
      payload.rejection_reason = rejectionReason?.trim() || null;
    } else {
      payload.rejection_reason = null;
    }

    const { error } = await admin.from("budgets").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/presupuestos/${id}`);
    revalidatePath("/admin/presupuestos");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteBudget(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("budgets").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/presupuestos");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Líneas ─────────────────────────────────────────────────────────────────

export interface SaveBudgetItemsInput {
  items: Array<{
    id?: string;                  // si existe, update; si no, insert
    concept: string;
    description?: string | null;
    quantity: number;
    unit?: string | null;
    unitPrice: number;
    discountPct?: number;
  }>;
}

export async function saveBudgetItems(
  budgetId: string,
  input: SaveBudgetItemsInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();

    // Estrategia simple: borrar todas y reinsertar (mantiene el position correcto)
    await admin.from("budget_items").delete().eq("budget_id", budgetId);

    if (input.items.length > 0) {
      const rows = input.items.map((it, idx) => ({
        budget_id: budgetId,
        position: idx,
        concept: it.concept.trim(),
        description: it.description?.trim() || null,
        quantity: it.quantity,
        unit: it.unit?.trim() || "ud",
        unit_price: it.unitPrice,
        discount_pct: it.discountPct ?? 0,
      }));
      const { error } = await admin.from("budget_items").insert(rows);
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath(`/admin/presupuestos/${budgetId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Convertir presupuesto aceptado en proyecto ────────────────────────────

export async function convertBudgetToProject(
  budgetId: string,
  serviceTypeId: string,
  propertyAddress: string,
): Promise<{ ok: boolean; requestId?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { data: budget } = await admin.from("budgets").select("*").eq("id", budgetId).single();
    if (!budget) return { ok: false, error: "Presupuesto no encontrado" };
    if (!budget.organization_id) return { ok: false, error: "El presupuesto debe tener cliente asignado" };

    // Calcular total (base + IVA)
    const { data: items } = await admin.from("budget_items").select("quantity, unit_price, discount_pct").eq("budget_id", budgetId);
    let base = 0;
    for (const it of items ?? []) {
      const gross = Number(it.quantity) * Number(it.unit_price);
      const discount = gross * (Number(it.discount_pct) / 100);
      base += gross - discount;
    }
    const total = base * (1 + Number(budget.vat_pct) / 100);

    // Buscar form_schema actual
    const { data: schema } = await admin.from("form_schemas").select("id").eq("service_type_id", serviceTypeId).eq("is_current", true).maybeSingle();
    if (!schema) return { ok: false, error: "Este servicio no tiene formulario configurado" };

    const { data: svc } = await admin.from("service_types").select("status_phases").eq("id", serviceTypeId).single();
    const phases = (svc?.status_phases as Array<{ key: string }> | null) ?? [];
    const now = new Date().toISOString();

    const { data: created, error: createErr } = await admin
      .from("certificate_requests")
      .insert({
        organization_id: budget.organization_id,
        service_type_id: serviceTypeId,
        form_schema_id: schema.id,
        form_data: {},
        status: "submitted",
        status_history: [{ status: "submitted", at: now }],
        property_address: propertyAddress.trim(),
        price: total,
        is_hidden_from_client: false,
        current_phase_key: phases.length > 0 ? phases[0].key : null,
        created_by: me.id,
        is_paid: false,
      })
      .select("id")
      .single();
    if (createErr) return { ok: false, error: createErr.message };

    // Marcar presupuesto convertido + asegurar aceptado
    await admin.from("budgets").update({
      converted_to_request_id: created.id,
      status: "accepted",
    }).eq("id", budgetId);

    // Si tiene oportunidad, marcarla ganada y vincular al proyecto
    if (budget.opportunity_id) {
      await admin.from("crm_opportunities").update({
        stage: "won",
        converted_to_request_id: created.id,
      }).eq("id", budget.opportunity_id);
    }

    revalidatePath(`/admin/presupuestos/${budgetId}`);
    revalidatePath("/admin/solicitudes");
    return { ok: true, requestId: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Aliases con tipos para reutilizar en client components ────────────────
export type _BudgetItem = BudgetItem;
export type _BudgetTemplateItem = BudgetTemplateItem;
