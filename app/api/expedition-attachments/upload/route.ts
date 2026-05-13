import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VALID_ENTITY_TYPES = ["decision", "incident", "site_visit"] as const;

type EntityType = (typeof VALID_ENTITY_TYPES)[number];

function isAllowedFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    name.endsWith(".pdf")
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Sin perfil" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const requestId = formData.get("requestId") as string | null;
    const entityType = formData.get("entityType") as EntityType | null;
    const entityId = formData.get("entityId") as string | null;

    if (!file || !requestId || !entityType || !entityId) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json({ ok: false, error: "Tipo de entidad inválido" }, { status: 400 });
    }

    if (!isAllowedFile(file)) {
      return NextResponse.json(
        { ok: false, error: "Solo se permiten imágenes y PDF" },
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

    if (profile.role !== "admin" && req.organization_id !== profile.organization_id) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const table =
      entityType === "decision"
        ? "expedition_decisions"
        : entityType === "incident"
          ? "expedition_incidents"
          : "expedition_site_visits";

    const { data: entity } = await supabase
      .from(table)
      .select("id, request_id, is_visible_to_client")
      .eq("id", entityId)
      .eq("request_id", requestId)
      .single();

    if (!entity) {
      return NextResponse.json({ ok: false, error: "Elemento no encontrado" }, { status: 404 });
    }

    if (profile.role !== "admin" && !entity.is_visible_to_client) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const storagePath = `${req.organization_id}/${requestId}/${entityType}/${entityId}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    const admin = createSupabaseAdminClient();

    const { error: uploadError } = await admin.storage
      .from("expedition-attachments")
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: "Error al subir archivo: " + uploadError.message },
        { status: 500 },
      );
    }

    const { error: dbError } = await admin.from("expedition_attachments").insert({
      request_id: requestId,
      entity_type: entityType,
      entity_id: entityId,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: contentType,
      size_bytes: file.size,
      uploaded_by: user.id,
      uploaded_by_role: profile.role,
    });

    if (dbError) {
      await admin.storage.from("expedition-attachments").remove([storagePath]);
      return NextResponse.json(
        { ok: false, error: "Error al guardar archivo: " + dbError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
