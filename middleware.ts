import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Excluimos:
    //  - assets estáticos de Next y archivos con extensión de imagen
    //  - /api/*    → cada route handler hace su propio auth.getUser(); evitamos
    //                una llamada de red extra a Supabase por cada request.
    //  - /auth/*   → /auth/callback hace exchangeCodeForSession por sí mismo y
    //                no necesita el refresh previo.
    "/((?!api/|auth/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
