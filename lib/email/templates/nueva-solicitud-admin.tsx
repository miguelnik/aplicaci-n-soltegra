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
  referenceCode: string;
  propertyAddress: string;
  clientName: string;
  requestUrl: string;
}

export function NuevaSolicitudAdminEmail({
  referenceCode,
  propertyAddress,
  clientName,
  requestUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Nueva solicitud de certificado energético — {referenceCode}</Preview>
      <Body style={{ backgroundColor: "#f6f9fc", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "560px", margin: "40px auto", backgroundColor: "#fff", borderRadius: "8px", padding: "32px" }}>
          <Heading style={{ color: "#1a7a3d", fontSize: "20px", marginBottom: "8px" }}>
            Nueva solicitud recibida
          </Heading>
          <Text style={{ color: "#444", margin: "0 0 16px" }}>
            <strong>{clientName}</strong> ha enviado una nueva solicitud de certificado energético.
          </Text>
          <Section style={{ backgroundColor: "#f0f8f4", borderRadius: "6px", padding: "16px", marginBottom: "24px" }}>
            <Text style={{ margin: "4px 0", fontSize: "14px" }}>
              <strong>Referencia:</strong> {referenceCode}
            </Text>
            <Text style={{ margin: "4px 0", fontSize: "14px" }}>
              <strong>Dirección:</strong> {propertyAddress}
            </Text>
          </Section>
          <Button
            href={requestUrl}
            style={{ backgroundColor: "#1a7a3d", color: "#fff", padding: "12px 24px", borderRadius: "6px", textDecoration: "none", fontSize: "14px" }}
          >
            Ver solicitud
          </Button>
          <Text style={{ color: "#999", fontSize: "12px", marginTop: "32px" }}>
            Soltegra · Plataforma de certificados energéticos
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
