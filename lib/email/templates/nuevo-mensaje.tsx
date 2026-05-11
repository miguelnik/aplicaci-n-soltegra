import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface Props {
  /** "admin" o "client" — quién recibe el email */
  recipientRole: "admin" | "client";
  senderName: string;
  messagePreview: string;
  referenceCode: string;
  propertyAddress: string;
  requestUrl: string;
}

export function NuevoMensajeEmail({
  recipientRole,
  senderName,
  messagePreview,
  referenceCode,
  propertyAddress,
  requestUrl,
}: Props) {
  const isAdmin = recipientRole === "admin";
  const heading = isAdmin
    ? `Nuevo mensaje del cliente`
    : `Soltegra te ha enviado un mensaje`;
  const preview = isAdmin
    ? `${senderName} ha escrito en la solicitud ${referenceCode}`
    : `Tienes un nuevo mensaje de Soltegra sobre tu solicitud`;
  const buttonLabel = isAdmin ? "Ver mensaje en el panel" : "Ver mensaje en la plataforma";
  const accent = isAdmin ? "#0F2B46" : "#0F2B46";

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f6f9fc", fontFamily: "sans-serif" }}>
        <Container
          style={{
            maxWidth: "560px",
            margin: "40px auto",
            backgroundColor: "#fff",
            borderRadius: "8px",
            padding: "32px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          {/* Franja superior dorada */}
          <Section
            style={{
              backgroundColor: "#C9A227",
              borderRadius: "4px",
              padding: "4px 0",
              marginBottom: "24px",
            }}
          />

          <Heading style={{ color: accent, fontSize: "20px", marginBottom: "8px" }}>
            {heading}
          </Heading>

          <Text style={{ color: "#444", margin: "0 0 20px" }}>
            {isAdmin
              ? `El cliente <strong>${senderName}</strong> ha enviado un mensaje relacionado con su solicitud.`
              : `El equipo de Soltegra ha respondido a tu solicitud.`}
          </Text>

          {/* Tarjeta de la solicitud */}
          <Section
            style={{
              backgroundColor: "#F5F7FA",
              borderRadius: "6px",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <Text style={{ margin: "4px 0", fontSize: "13px", color: "#555" }}>
              <strong>Referencia:</strong> {referenceCode}
            </Text>
            <Text style={{ margin: "4px 0", fontSize: "13px", color: "#555" }}>
              <strong>Dirección:</strong> {propertyAddress}
            </Text>
          </Section>

          {/* Vista previa del mensaje */}
          <Section
            style={{
              borderLeft: "3px solid #C9A227",
              paddingLeft: "14px",
              marginBottom: "28px",
            }}
          >
            <Text
              style={{
                fontSize: "14px",
                color: "#333",
                fontStyle: "italic",
                margin: 0,
                lineHeight: "1.5",
              }}
            >
              {messagePreview.length > 200
                ? messagePreview.slice(0, 200) + "…"
                : messagePreview}
            </Text>
          </Section>

          <Button
            href={requestUrl}
            style={{
              backgroundColor: "#0F2B46",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            {buttonLabel}
          </Button>

          <Text style={{ color: "#999", fontSize: "12px", marginTop: "32px" }}>
            Soltegra · Plataforma de certificados energéticos
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
