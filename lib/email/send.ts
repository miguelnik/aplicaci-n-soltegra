import "server-only";
import { render } from "@react-email/components";
import { getResend, FROM_EMAIL, APP_URL, ADMIN_EMAILS } from "./client";
import { NuevaSolicitudAdminEmail } from "./templates/nueva-solicitud-admin";
import { EstadoActualizadoEmail } from "./templates/estado-actualizado";
import { CertificadoListoEmail } from "./templates/certificado-listo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function logEmail(to: string, template: string, payload: Record<string, unknown>) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from("email_notifications").insert({ to_email: to, template, payload, sent_at: new Date().toISOString() });
  } catch { /* no bloquea el flujo */ }
}

export async function sendNuevaSolicitudAdmin(params: {
  referenceCode: string;
  propertyAddress: string;
  clientName: string;
  requestId: string;
}) {
  if (!ADMIN_EMAILS.length) return;
  const requestUrl = `${APP_URL}/admin/solicitudes/${params.requestId}`;
  const html = await render(NuevaSolicitudAdminEmail({ ...params, requestUrl }));

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAILS,
    subject: `Nueva solicitud — ${params.referenceCode}`,
    html,
  });

  if (!error) await logEmail(ADMIN_EMAILS.join(","), "nueva_solicitud_admin", params);
}

export async function sendEstadoActualizado(params: {
  toEmail: string;
  referenceCode: string;
  propertyAddress: string;
  newStatus: string;
  estimatedDelivery?: string;
  requestId: string;
}) {
  const dashboardUrl = `${APP_URL}/solicitudes/${params.requestId}`;
  const html = await render(EstadoActualizadoEmail({ ...params, dashboardUrl }));

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.toEmail,
    subject: `Actualización de tu certificado — ${params.referenceCode}`,
    html,
  });

  if (!error) await logEmail(params.toEmail, "estado_actualizado", params);
}

export async function sendCertificadoListo(params: {
  toEmail: string;
  referenceCode: string;
  propertyAddress: string;
  requestId: string;
}) {
  const downloadUrl = `${APP_URL}/solicitudes/${params.requestId}/descargar`;
  const html = await render(CertificadoListoEmail({ ...params, downloadUrl }));

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.toEmail,
    subject: `Tu certificado energético está listo — ${params.referenceCode}`,
    html,
  });

  if (!error) await logEmail(params.toEmail, "certificado_listo", params);
}
