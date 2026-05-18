"use server";

// Server actions para crear solicitudes desde la vista del admin
// (a diferencia de las del cliente, el admin puede asignar visibilidad,
//  precio, asignar a sí mismo cualquier cliente, etc.)

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface CreateAdminRequestInput {
  organizationId: string;
  serviceTypeId: string;
  propertyAddress: string;
  clientNotes?: string | null;
  clientDeadline?: string | null;   // YYYY-MM-DD
  price?: number | null;
  isHiddenFromClient: boolean;
}

export async function createAdminRequest(
  input: CreateAdminRequestInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const me = await requireAdmin();
    const admin = createSupabaseAdminClient();

    // Validaciones mínimas
    if (!input.organizationId) return { ok: false, error: "Falta el cliente" };
    if (!input.serviceTypeId)  return { ok: false, error: "Falta el servicio" };
    if (!input.propertyAddress?.trim()) {
      return { ok: false, error: "Falta el nombre/dirección del proyecto" };
    }

    // Buscar el form_schema actual del servicio
    const { data: schema, error: schemaErr } = await admin
      .from("form_schemas")
      .select("id")
      .eq("service_type_id", input.serviceTypeId)
      .eq("is_current", true)
      .maybeSingle();

    if (schemaErr) return { ok: false, error: "Error consultando schema: " + schemaErr.message };
    if (!schema) {
      return {
        ok: false,
        error: "Este servicio no tiene un formulario configurado todavía. Edítalo desde Servicios → Editar formulario y crea al menos una versión.",
      };
    }

    // Buscar la primera fase del servicio (si las tiene)
    const { data: svc } = await admin
      .from("service_types")
      .select("status_phases")
      .eq("id", input.serviceTypeId)
      .single();

    const phases = (svc?.status_phases as Array<{ key: string }> | null) ?? [];
    const initialPhaseKey = phases.length > 0 ? phases[0].key : null;

    // Crear la solicitud
    const now = new Date().toISOString();
    const { data: created, error: insertErr } = await admin
      .from("certificate_requests")
      .insert({
        organization_id: input.organizationId,
        service_type_id: input.serviceTypeId,
        form_schema_id: schema.id,
        form_data: {},
        status: "submitted",
        status_history: [{ status: "submitted", at: now }],
        property_address: input.propertyAddress.trim(),
        client_notes: input.clientNotes?.trim() || null,
        client_deadline: input.clientDeadline || null,
        price: input.price ?? null,
        is_hidden_from_client: input.isHiddenFromClient,
        current_phase_key: initialPhaseKey,
        created_by: me.id,                 // creado por el admin
        is_paid: false,
      })
      .select("id")
      .single();

    if (insertErr) return { ok: false, error: "Error creando solicitud: " + insertErr.message };

    return { ok: true, id: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
