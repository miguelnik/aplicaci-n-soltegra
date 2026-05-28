import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Acepta solo rutas internas absolutas. Bloquea:
 *  - URLs absolutas (http://, https://, //evil.com)
 *  - Esquemas peligrosos (javascript:, data:, etc.)
 *  - Path traversal con backslash que algunos navegadores normalizan a /
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  // Debe empezar exactamente con "/" y NO con "//" ni "/\"
  if (raw[0] !== "/") return "/";
  if (raw[1] === "/" || raw[1] === "\\") return "/";
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("El enlace ha expirado o ya fue usado. Solicita uno nuevo.")}`,
  );
}
