import "server-only";
import { render } from "@react-email/components";
import { getResend, FROM_EMAIL, APP_URL, ADMIN_EMAILS } from "./client";
import { NuevaSolicitudAdminEmail } from "./templates/nueva-solicitud-admin";
import { EstadoActualizadoEmail } from "./templates/estado-actualizado";
import { CertificadoListoEmail } from "./templates/certificado-listo";
import { NuevoMensajeEmail } from "./templates/nuevo-mensaje";
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

/**
 * Notifica al destinatario que ha recibido un nuevo mensaje en el chat.
 * - authorRole="client"  → avisa a los admins
 * - authorRole="admin"   → avisa al email del cliente de la solicitud
 */
export async function sendNuevoMensaje(params: {
  authorRole: "admin" | "client";
  authorName: string;
  messageBody: string;
  referenceCode: string;
  propertyAddress: string;
  requestId: string;
  /** Email del cliente propietario de la solicitud */
  clientEmail: string;
}) {
  const {
    authorRole, authorName, messageBody,
    referenceCode, propertyAddress, requestId, clientEmail,
  } = params;

  if (authorRole === "client") {
    // Cliente escribió → notificar a los admins
    if (!ADMIN_EMAILS.length) return;
    const requestUrl = `${APP_URL}/admin/solicitudes/${requestId}`;
    const html = await render(
      NuevoMensajeEmail({
        recipientRole: "admin",
        senderName: authorName,
        messagePreview: messageBody,
        referenceCode,
        propertyAddress,
        requestUrl,
      }),
    );
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAILS,
      subject: `Nuevo mensaje del cliente — ${referenceCode}`,
      html,
    });
    if (!error) await logEmail(ADMIN_EMAILS.join(","), "nuevo_mensaje_admin", params);
  } else {
    // Admin escribió → notificar al cliente
    if (!clientEmail) return;
    const requestUrl = `${APP_URL}/solicitudes/${requestId}`;
    const html = await render(
      NuevoMensajeEmail({
        recipientRole: "client",
        senderName: "Soltegra",
        messagePreview: messageBody,
        referenceCode,
        propertyAddress,
        requestUrl,
      }),
    );
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: clientEmail,
      subject: `Soltegra te ha enviado un mensaje — ${referenceCode}`,
      html,
    });
    if (!error) await logEmail(clientEmail, "nuevo_mensaje_cliente", params);
  }
}
