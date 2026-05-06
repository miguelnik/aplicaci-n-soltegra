import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireClient();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: req } = await supabase
    .from("certificate_requests")
    .select("certificate_pdf_path, organization_id, status")
    .eq("id", id)
    .single();

  if (!req || req.organization_id !== profile.organization_id) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  if (req.status !== "delivered" || !req.certificate_pdf_path) {
    return new NextResponse("Certificado no disponible", { status: 403 });
  }

  // Generar signed URL (15 minutos)
  const { data: signedUrl, error } = await supabase.storage
    .from("certificates")
    .createSignedUrl(req.certificate_pdf_path, 900);

  if (error || !signedUrl) {
    return new NextResponse("Error generando enlace", { status: 500 });
  }

  return NextResponse.redirect(signedUrl.signedUrl);
}
