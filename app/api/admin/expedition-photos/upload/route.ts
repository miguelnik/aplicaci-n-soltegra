// POST /api/admin/expedition-photos/upload
// Sube una foto al bucket 'expedition-photos' e inserta en expedition_photos.
// Solo accesible para administradores.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    // ── Parsear form data ────────────────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const requestId = formData.get("requestId") as string | null;
    const organizationId = formData.get("organizationId") as string | null;
    const caption = (formData.get("caption") as string | null)?.trim() || null;
    const takenAt = (formData.get("takenAt") as string | null)?.trim() || null;
    const visibleToClient = formData.get("visibleToClient") !== "0";

    if (!file || !requestId || !organizationId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: file, requestId, organizationId" },
        { status: 400 },
      );
    }

    // Validar que sea imagen
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      return NextResponse.json(
        { ok: false, error: "Solo se permiten imágenes y PDF para fotos de obra" },
        { status: 400 },
      );
    }

    // ── Subir al bucket ──────────────────────────────────────────────────────
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const uuid = crypto.randomUUID();
    const storagePath = `${organizationId}/${requestId}/${uuid}.${ext}`;

    const adminClient = createSupabaseAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from("expedition-photos")
      .upload(storagePath, buffer, {
        contentType: file.type || "image/jpeg",
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
      is_visible_to_client: visibleToClient,
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
