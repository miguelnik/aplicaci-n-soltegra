import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendCertificadoListo } from "@/lib/email/send";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, newStatus, deliveryDate, notes } = body as {
      requestId: string;
      newStatus: string;
      deliveryDate: string;
      notes: string;
    };

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

    if (!profile || profile.role !== "admin") {
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
      return NextResponse.json(
        { ok: false, error: `RPC: ${error.message} (code: ${error.code}, details: ${error.details})` },
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("update-status API error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
