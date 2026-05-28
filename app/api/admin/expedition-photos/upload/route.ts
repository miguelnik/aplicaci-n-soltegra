// POST /api/admin/expedition-photos/upload
// Sube una foto al bucket 'expedition-photos' e inserta en expedition_photos.
// Accesible para administradores y clientes de la organización propietaria.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VALID_SOURCE_ENTITY_TYPES = ["decision", "incident", "site_visit"] as const;
type SourceEntityType = (typeof VALID_SOURCE_ENTITY_TYPES)[number];

// 25 MB es suficiente para fotos de obra a calidad alta tras compresión cliente.
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    // ── Autenticación y autorización ─────────────────────────────────────────
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    // ── Parsear form data ────────────────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const requestId = formData.get("requestId") as string | null;
    const caption = (formData.get("caption") as string | null)?.trim() || null;
    const takenAt = (formData.get("takenAt") as string | null)?.trim() || null;
    const visibleToClient = formData.get("visibleToClient") !== "0";
    // Trazabilidad: entidad origen de la foto (opcional, pero allowlist estricta)
    const rawSourceEntityType = (formData.get("sourceEntityType") as string | null) || null;
    const sourceEntityId   = (formData.get("sourceEntityId")   as string | null) || null;

    let sourceEntityType: SourceEntityType | null = null;
    if (rawSourceEntityType) {
      if (!VALID_SOURCE_ENTITY_TYPES.includes(rawSourceEntityType as SourceEntityType)) {
        return NextResponse.json(
          { ok: false, error: "sourceEntityType inválido" },
          { status: 400 },
        );
      }
      sourceEntityType = rawSourceEntityType as SourceEntityType;
    }

    if (!file || !requestId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: file, requestId" },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: `El archivo supera el tamaño máximo permitido (${MAX_FILE_SIZE / (1024 * 1024)} MB)` },
        { status: 413 },
      );
    }

    const lowerName = file.name.toLowerCase();
    const isMobileImage =
      lowerName.endsWith(".heic") || lowerName.endsWith(".heif");

    // Validar que sea imagen
    if (!file.type.startsWith("image/") && !isMobileImage) {
      return NextResponse.json(
        { ok: false, error: "Solo se permiten imágenes para fotos de obra" },
        { status: 400 },
      );
    }

    const { data: req } = await supabase
      .from("certificate_requests")
      .select("id, organization_id")
      .eq("id", requestId)
      .single();

    if (!req) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }

    const isAdmin = profile.role === "admin" || profile.role === "superadmin";
    if (!isAdmin && req.organization_id !== profile.organization_id) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    // ── Subir al bucket ──────────────────────────────────────────────────────
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const uuid = crypto.randomUUID();
    const storagePath = `${req.organization_id}/${requestId}/${uuid}.${ext}`;

    const adminClient = createSupabaseAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from("expedition-photos")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: "Error al subir imagen: " + uploadError.message },
        { status: 500 },
      );
    }

    // ── Insertar en BD ───────────────────────────────────────────────────────
    const { error: dbError } = await adminClient.from("expedition_photos").insert({
      request_id: requestId,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      caption,
      taken_at: takenAt || null,
      is_visible_to_client: isAdmin ? visibleToClient : true,
      uploaded_by: user.id,
      uploaded_by_role: isAdmin ? "admin" : "client",
      source_entity_type: sourceEntityType,
      source_entity_id:   sourceEntityType ? (sourceEntityId || null) : null,
    });

    if (dbError) {
      await adminClient.storage.from("expedition-photos").remove([storagePath]);
      return NextResponse.json(
        { ok: false, error: "Error al guardar en BD: " + dbError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[expedition-photos/upload]", err);
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
