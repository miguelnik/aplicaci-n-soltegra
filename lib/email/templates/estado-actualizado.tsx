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

const STATUS_LABELS: Record<string, string> = {
  in_review: "en revisión",
  in_progress: "en redacción",
  awaiting_info: "pendiente de información adicional",
  delivered: "entregado",
  cancelled: "cancelado",
};

interface Props {
  referenceCode: string;
  propertyAddress: string;
  newStatus: string;
  estimatedDelivery?: string;
  dashboardUrl: string;
}

export function EstadoActualizadoEmail({
  referenceCode,
  propertyAddress,
  newStatus,
  estimatedDelivery,
  dashboardUrl,
}: Props) {
  const statusLabel = STATUS_LABELS[newStatus] ?? newStatus;

  return (
    <Html>
      <Head />
      <Preview>Tu certificado energético está {statusLabel}</Preview>
      <Body style={{ backgroundColor: "#f6f9fc", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "560px", margin: "40px auto", backgroundColor: "#fff", borderRadius: "8px", padding: "32px" }}>
          <Heading style={{ color: "#1a7a3d", fontSize: "20px", marginBottom: "8px" }}>
            Actualización de tu solicitud
          </Heading>
          <Text style={{ color: "#444", margin: "0 0 16px" }}>
            Tu certificado energético se encuentra ahora <strong>{statusLabel}</strong>.
          </Text>
          <Section style={{ backgroundColor: "#f0f8f4", borderRadius: "6px", padding: "16px", marginBottom: "24px" }}>
            <Text style={{ margin: "4px 0", fontSize: "14px" }}>
              <strong>Referencia:</strong> {referenceCode}
            </Text>
            <Text style={{ margin: "4px 0", fontSize: "14px" }}>
              <strong>Dirección:</strong> {propertyAddress}
            </Text>
            {estimatedDelivery && (
              <Text style={{ margin: "4px 0", fontSize: "14px" }}>
                <strong>Entrega prevista:</strong> {estimatedDelivery}
              </Text>
            )}
          </Section>
          <Button
            href={dashboardUrl}
            style={{ backgroundColor: "#1a7a3d", color: "#fff", padding: "12px 24px", borderRadius: "6px", textDecoration: "none", fontSize: "14px" }}
          >
            Ver mi certificado
          </Button>
          <Text style={{ color: "#999", fontSize: "12px", marginTop: "32px" }}>
            Soltegra · Plataforma de certificados energéticos
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
