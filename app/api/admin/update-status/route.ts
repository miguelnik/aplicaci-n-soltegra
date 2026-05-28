import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendCertificadoListo } from "@/lib/email/send";

const BodySchema = z.object({
  requestId: z.string().uuid(),
  newStatus: z.string().min(1).max(50),
  deliveryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }
    const { requestId, newStatus, deliveryDate, notes } = parsed.data;

    // Verificar que es admin usando el server client (tiene cookies/sesión)
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }

    // Llamar al RPC con el server client (tiene auth.uid() para is_admin())
    const { data: req, error } = await supabase
      .rpc("admin_update_request_status", {
        p_request_id: requestId,
        p_new_status: newStatus,
        p_estimated_delivery_date: deliveryDate || null,
        p_internal_notes: notes || null,
      })
      .single();

    if (error) {
      // No exponer detalles de Postgres al cliente: se loguea en servidor y
      // devolvemos un mensaje genérico.
      console.error("[update-status] RPC error", { code: error.code, message: error.message, details: error.details });
      return NextResponse.json(
        { ok: false, error: "No se pudo actualizar el estado" },
        { status: 400 },
      );
    }

    if (!req) {
      return NextResponse.json(
        { ok: false, error: "No se devolvieron datos de la solicitud" },
        { status: 400 },
      );
    }

    const reqData = req as {
      created_by: string;
      reference_code: string;
      property_address: string;
    };

    // Solo enviar email al cliente cuando el estado pasa a "delivered"
    if (newStatus === "delivered") {
      try {
        const adminClient = createSupabaseAdminClient();
        const { data: authUser } = await adminClient.auth.admin.getUserById(reqData.created_by);
        const email = authUser?.user?.email;

        if (email) {
          await sendCertificadoListo({
            toEmail: email,
            referenceCode: reqData.reference_code ?? requestId,
            propertyAddress: reqData.property_address ?? "",
            requestId,
          });
        }
      } catch {
        // El fallo del email no bloquea el cambio de estado
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("update-status API error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
