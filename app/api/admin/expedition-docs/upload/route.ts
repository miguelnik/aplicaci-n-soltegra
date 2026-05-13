// POST /api/admin/expedition-docs/upload
// Sube un documento al bucket 'expedition-docs' e inserta en expedition_documents.
// Solo accesible para administradores.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // ── Autenticación y autorización ────────────────────────────────────────
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

    // ── Parsear multipart form data ──────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const requestId = formData.get("requestId") as string | null;
    const label = (formData.get("label") as string | null)?.trim();
    const category = formData.get("category") as string | null;
    const visibleToClient = formData.get("visibleToClient") === "1";

    if (!file || !requestId || !label || !category) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios (file, requestId, label, category)" },
        { status: 400 },
      );
    }

    const validCategories = ["deliverable", "admin_document", "client_document"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { ok: false, error: `Categoría inválida. Debe ser: ${validCategories.join(", ")}` },
        { status: 400 },
      );
    }

    // ── Verificar que la solicitud existe ────────────────────────────────────
    const { data: req } = await supabase
      .from("certificate_requests")
      .select("id, organization_id")
      .eq("id", requestId)
      .single();

    if (!req) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }

    // ── Subir archivo al bucket ──────────────────────────────────────────────
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const uuid = crypto.randomUUID();
    const storagePath = `${req.organization_id}/${requestId}/${uuid}.${ext}`;

    const adminClient = createSupabaseAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from("expedition-docs")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: "Error al subir archivo: " + uploadError.message },
        { status: 500 },
      );
    }

    // ── Insertar registro en expedition_documents ────────────────────────────
    const { error: dbError } = await adminClient
      .from("expedition_documents")
      .insert({
        request_id: requestId,
        category,
        label,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        is_visible_to_client: visibleToClient,
        uploaded_by: user.id,
      });

    if (dbError) {
      // Limpiar el archivo subido si el insert falla
      await adminClient.storage.from("expedition-docs").remove([storagePath]);
      return NextResponse.json(
        { ok: false, error: "Error al guardar en BD: " + dbError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[expedition-docs/upload]", err);
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
