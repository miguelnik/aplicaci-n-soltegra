"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function backUrl(requestId: string, tab: string) {
  return `/admin/solicitudes/${requestId}/expediente?tab=${tab}`;
}

// ────────────────────────────────────────────────────────────────────────────
// HITOS
// ────────────────────────────────────────────────────────────────────────────

export async function saveMilestone(requestId: string, formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const id = formData.get("id") as string | null;
  const payload = {
    request_id: requestId,
    title: (formData.get("title") as string).trim(),
    description: (formData.get("description") as string)?.trim() || null,
    due_date: (formData.get("due_date") as string) || null,
    status: (formData.get("status") as string) || "pending",
    is_visible_to_client: formData.get("is_visible_to_client") === "1",
    order: parseInt(formData.get("order") as string, 10) || 0,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    await admin.from("expedition_milestones").update(payload).eq("id", id);
  } else {
    await admin.from("expedition_milestones").insert(payload);
  }
  redirect(backUrl(requestId, "milestones"));
}

export async function completeMilestone(requestId: string, id: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  await admin
    .from("expedition_milestones")
    .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  redirect(backUrl(requestId, "milestones"));
}

export async function deleteMilestone(requestId: string, id: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  await admin.from("expedition_milestones").delete().eq("id", id);
  redirect(backUrl(requestId, "milestones"));
}

// ────────────────────────────────────────────────────────────────────────────
// DECISIONES
// ────────────────────────────────────────────────────────────────────────────

export async function saveDecision(requestId: string, formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const id = formData.get("id") as string | null;
  const payload = {
    request_id: requestId,
    title: (formData.get("title") as string).trim(),
    description: (formData.get("description") as string)?.trim() || null,
    deadline: (formData.get("deadline") as string) || null,
    status: (formData.get("status") as string) || "pending",
    is_visible_to_client: formData.get("is_visible_to_client") === "1",
    updated_at: new Date().toISOString(),
  };

  if (id) {
    await admin.from("expedition_decisions").update(payload).eq("id", id);
  } else {
    await admin.from("expedition_decisions").insert(payload);
  }
  redirect(backUrl(requestId, "decisions"));
}

export async function deleteDecision(requestId: string, id: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  await admin.from("expedition_decisions").delete().eq("id", id);
  redirect(backUrl(requestId, "decisions"));
}

// ────────────────────────────────────────────────────────────────────────────
// INCIDENCIAS
// ────────────────────────────────────────────────────────────────────────────

export async function saveIncident(requestId: string, formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const id = formData.get("id") as string | null;
  const status = (formData.get("status") as string) || "open";
  const payload = {
    request_id: requestId,
    title: (formData.get("title") as string).trim(),
    description: (formData.get("description") as string)?.trim() || null,
    severity: (formData.get("severity") as string) || "medium",
    status,
    is_visible_to_client: formData.get("is_visible_to_client") === "1",
    resolved_at:
      (status === "resolved" || status === "closed")
        ? new Date().toISOString()
        : null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    await admin.from("expedition_incidents").update(payload).eq("id", id);
  } else {
    await admin.from("expedition_incidents").insert(payload);
  }
  redirect(backUrl(requestId, "incidents"));
}

export async function deleteIncident(requestId: string, id: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  await admin.from("expedition_incidents").delete().eq("id", id);
  redirect(backUrl(requestId, "incidents"));
}

// ────────────────────────────────────────────────────────────────────────────
// RIESGOS
// ────────────────────────────────────────────────────────────────────────────

export async function saveRisk(requestId: string, formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const id = formData.get("id") as string | null;
  const payload = {
    request_id: requestId,
    title: (formData.get("title") as string).trim(),
    description: (formData.get("description") as string)?.trim() || null,
    probability: (formData.get("probability") as string) || "medium",
    impact: (formData.get("impact") as string) || "medium",
    status: (formData.get("status") as string) || "identified",
    mitigation: (formData.get("mitigation") as string)?.trim() || null,
    is_visible_to_client: formData.get("is_visible_to_client") === "1",
    updated_at: new Date().toISOString(),
  };

  if (id) {
    await admin.from("expedition_risks").update(payload).eq("id", id);
  } else {
    await admin.from("expedition_risks").insert(payload);
  }
  redirect(backUrl(requestId, "risks"));
}

export async function deleteRisk(requestId: string, id: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  await admin.from("expedition_risks").delete().eq("id", id);
  redirect(backUrl(requestId, "risks"));
}

// ────────────────────────────────────────────────────────────────────────────
// VISITAS DE OBRA
// ────────────────────────────────────────────────────────────────────────────

export async function saveSiteVisit(requestId: string, formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const id = formData.get("id") as string | null;
  const payload = {
    request_id: requestId,
    visited_at: (formData.get("visited_at") as string).trim(),
    technician: (formData.get("technician") as string).trim(),
    observations: (formData.get("observations") as string)?.trim() || null,
    is_visible_to_client: formData.get("is_visible_to_client") === "1",
  };

  if (id) {
    await admin.from("expedition_site_visits").update(payload).eq("id", id);
  } else {
    await admin.from("expedition_site_visits").insert(payload);
  }
  redirect(backUrl(requestId, "site_visits"));
}

export async function deleteSiteVisit(requestId: string, id: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  await admin.from("expedition_site_visits").delete().eq("id", id);
  redirect(backUrl(requestId, "site_visits"));
}

// ────────────────────────────────────────────────────────────────────────────
// ACTAS
// ────────────────────────────────────────────────────────────────────────────

export async function saveMeetingMinute(requestId: string, formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const id = formData.get("id") as string | null;
  const attendeesRaw = (formData.get("attendees") as string)?.trim();
  const actionPointsRaw = (formData.get("action_points") as string)?.trim();

  const payload = {
    request_id: requestId,
    title: (formData.get("title") as string).trim(),
    meeting_date: (formData.get("meeting_date") as string).trim(),
    attendees: attendeesRaw
      ? attendeesRaw.split("\n").map((s) => s.trim()).filter(Boolean)
      : null,
    summary: (formData.get("summary") as string)?.trim() || null,
    action_points: actionPointsRaw
      ? actionPointsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
      : null,
    is_visible_to_client: formData.get("is_visible_to_client") === "1",
  };

  if (id) {
    await admin.from("expedition_meeting_minutes").update(payload).eq("id", id);
  } else {
    await admin.from("expedition_meeting_minutes").insert(payload);
  }
  redirect(backUrl(requestId, "meeting_minutes"));
}

export async function deleteMeetingMinute(requestId: string, id: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  await admin.from("expedition_meeting_minutes").delete().eq("id", id);
  redirect(backUrl(requestId, "meeting_minutes"));
}

// ────────────────────────────────────────────────────────────────────────────
// PRESUPUESTO Y PARTIDAS
// ────────────────────────────────────────────────────────────────────────────

export async function saveBudget(requestId: string, formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const id = formData.get("id") as string | null;
  const initialBudget = parseFloat(formData.get("initial_budget") as string);
  const payload = {
    request_id: requestId,
    initial_budget: isNaN(initialBudget) ? null : initialBudget,
    currency: (formData.get("currency") as string) || "EUR",
    notes: (formData.get("notes") as string)?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    await admin.from("expedition_budget").update(payload).eq("id", id);
  } else {
    await admin.from("expedition_budget").insert(payload);
  }
  redirect(backUrl(requestId, "economic"));
}

export async function saveCostItem(requestId: string, formData: FormData) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const id = formData.get("id") as string | null;
  const amount = parseFloat(formData.get("amount") as string);
  const payload = {
    request_id: requestId,
    description: (formData.get("description") as string).trim(),
    amount: isNaN(amount) ? 0 : amount,
    category: (formData.get("category") as string) || "other",
    is_approved: formData.get("is_approved") === "1",
    date: (formData.get("date") as string) || null,
  };

  if (id) {
    await admin.from("expedition_cost_items").update(payload).eq("id", id);
  } else {
    await admin.from("expedition_cost_items").insert(payload);
  }
  redirect(backUrl(requestId, "economic"));
}

export async function deleteCostItem(requestId: string, id: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  await admin.from("expedition_cost_items").delete().eq("id", id);
  redirect(backUrl(requestId, "economic"));
}

// ────────────────────────────────────────────────────────────────────────────
// FOTOS
// ────────────────────────────────────────────────────────────────────────────

export async function deletePhoto(requestId: string, id: string, storagePath: string) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  await admin.storage.from("expedition-photos").remove([storagePath]);
  await admin.from("expedition_photos").delete().eq("id", id);
  redirect(backUrl(requestId, "photos"));
}

export async function updatePhotoVisibility(
  requestId: string,
  id: string,
  visible: boolean,
) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();
  await admin
    .from("expedition_photos")
    .update({ is_visible_to_client: visible })
    .eq("id", id);
  redirect(backUrl(requestId, "photos"));
}
