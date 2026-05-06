import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  await requireAdmin();
  const { fileId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: file } = await supabase
    .from("request_files")
    .select("storage_path, original_filename")
    .eq("id", fileId)
    .single();

  if (!file) return new NextResponse("No encontrado", { status: 404 });

  const { data: signedUrl, error } = await supabase.storage
    .from("request-uploads")
    .createSignedUrl(file.storage_path, 900, {
      download: file.original_filename,
    });

  if (error || !signedUrl) return new NextResponse("Error generando enlace", { status: 500 });

  return NextResponse.redirect(signedUrl.signedUrl);
}
