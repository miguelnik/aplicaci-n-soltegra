/* eslint-disable jsx-a11y/alt-text */
// ============================================================================
// Generador del PDF profesional de un presupuesto.
// Se usa desde un Route Handler para descargar el archivo.
// ============================================================================

import { renderToBuffer, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Budget, BudgetItem, CompanySettings } from "./types";
import { computeBudgetTotals } from "./types";

const PRIMARY = "#0f766e";   // teal-700
const MUTED = "#6b7280";     // gray-500
const BORDER = "#e5e7eb";    // gray-200
const HEADER_BG = "#f3f4f6"; // gray-100

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, color: "#111827", fontFamily: "Helvetica" },

  // Cabecera
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 25 },
  logo: { width: 110 },
  companyBlock: { textAlign: "right", fontSize: 8, color: MUTED, lineHeight: 1.5 },
  companyName: { fontSize: 11, fontWeight: 700, color: "#111827" },

  // Título y meta
  titleBlock: { borderTopWidth: 2, borderTopColor: PRIMARY, paddingTop: 12, marginBottom: 15 },
  budgetNumber: { fontSize: 18, fontWeight: 700, color: PRIMARY, letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, fontSize: 8.5 },
  metaLabel: { color: MUTED, fontWeight: 700 },
  metaValue: { color: "#111827" },

  // Bloque cliente
  twoCol: { flexDirection: "row", gap: 15, marginBottom: 18 },
  clientCard: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 10 },
  clientCardTitle: { fontSize: 8, color: MUTED, textTransform: "uppercase", fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 },
  clientName: { fontSize: 10.5, fontWeight: 700, marginBottom: 2 },
  clientLine: { fontSize: 8.5, color: "#374151", lineHeight: 1.4 },

  // Intro / título
  title: { fontSize: 13, fontWeight: 700, marginBottom: 6 },
  intro: { fontSize: 9, color: "#374151", lineHeight: 1.5, marginBottom: 16 },

  // Tabla
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, marginBottom: 14, overflow: "hidden" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: HEADER_BG, borderBottomWidth: 1, borderBottomColor: BORDER },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER },
  tableRowLast: { borderBottomWidth: 0 },

  th: { padding: 7, fontSize: 8, fontWeight: 700, color: MUTED, textTransform: "uppercase" },
  td: { padding: 7, fontSize: 9 },

  colConcept: { flex: 4 },
  colQty:     { flex: 0.8, textAlign: "right" },
  colUnit:    { flex: 0.6, textAlign: "center", color: MUTED },
  colPrice:   { flex: 1.2, textAlign: "right" },
  colDisc:    { flex: 0.8, textAlign: "right", color: MUTED },
  colTotal:   { flex: 1.4, textAlign: "right", fontWeight: 700 },

  conceptName: { fontWeight: 700, fontSize: 9 },
  conceptDesc: { fontSize: 8, color: MUTED, marginTop: 1.5, lineHeight: 1.4 },

  // Totales
  totalsBlock: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 18 },
  totalsTable: { width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 8, fontSize: 9 },
  totalsRowBorder: { borderTopWidth: 1, borderTopColor: BORDER },
  totalsRowFinal: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: PRIMARY, color: "#ffffff",
    paddingVertical: 8, paddingHorizontal: 8,
    fontSize: 11, fontWeight: 700, borderRadius: 3,
  },

  // Bloque condiciones
  conditions: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12, marginTop: 6 },
  conditionsTitle: { fontSize: 8, color: MUTED, textTransform: "uppercase", fontWeight: 700, marginBottom: 5, letterSpacing: 0.5 },
  conditionsText: { fontSize: 8.5, color: "#374151", lineHeight: 1.5 },

  // Pie
  footer: {
    position: "absolute",
    bottom: 25, left: 40, right: 40,
    fontSize: 7.5, color: MUTED,
    textAlign: "center",
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
  },
});

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

interface BudgetPdfProps {
  budget: Budget;
  items: BudgetItem[];
  company: CompanySettings;
  logoDataUrl?: string | null;
}

function BudgetPdf({ budget, items, company, logoDataUrl }: BudgetPdfProps) {
  const totals = computeBudgetTotals(items, Number(budget.vat_pct));
  const issueDateLabel = budget.issue_date
    ? format(parseISO(budget.issue_date), "d 'de' MMMM 'de' yyyy", { locale: es })
    : "";
  const validUntilLabel = budget.valid_until
    ? format(parseISO(budget.valid_until), "d 'de' MMMM 'de' yyyy", { locale: es })
    : "";

  const companyAddress = [
    company.address_line1,
    company.address_line2,
    [company.postal_code, company.city].filter(Boolean).join(" "),
    company.province,
  ].filter(Boolean).join("\n");

  return (
    <Document
      title={`Presupuesto ${budget.number ?? ""}`}
      author={company.legal_name}
      subject="Presupuesto"
    >
      <Page size="A4" style={styles.page}>
        {/* Cabecera con logo + datos empresa */}
        <View style={styles.header}>
          <View>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.logo} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>{company.trade_name ?? company.legal_name}</Text>
            )}
          </View>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{company.legal_name}</Text>
            {company.cif && <Text>{`CIF: ${company.cif}`}</Text>}
            {companyAddress && <Text>{companyAddress}</Text>}
            {company.phone && <Text>{`Tel. ${company.phone}`}</Text>}
            {company.email && <Text>{company.email}</Text>}
            {company.website && <Text>{company.website}</Text>}
          </View>
        </View>

        {/* Número de presupuesto + fechas */}
        <View style={styles.titleBlock}>
          <Text style={styles.budgetNumber}>PRESUPUESTO {budget.number ?? ""}</Text>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaLabel}>FECHA DE EMISIÓN</Text>
              <Text style={styles.metaValue}>{issueDateLabel}</Text>
            </View>
            {validUntilLabel && (
              <View>
                <Text style={[styles.metaLabel, { textAlign: "right" }]}>VÁLIDO HASTA</Text>
                <Text style={[styles.metaValue, { textAlign: "right" }]}>{validUntilLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.twoCol}>
          <View style={styles.clientCard}>
            <Text style={styles.clientCardTitle}>Cliente</Text>
            <Text style={styles.clientName}>{budget.client_legal_name ?? "—"}</Text>
            {budget.client_cif && <Text style={styles.clientLine}>{`CIF: ${budget.client_cif}`}</Text>}
            {budget.client_address && <Text style={styles.clientLine}>{budget.client_address}</Text>}
            {budget.client_phone && <Text style={styles.clientLine}>{`Tel. ${budget.client_phone}`}</Text>}
            {budget.client_email && <Text style={styles.clientLine}>{budget.client_email}</Text>}
          </View>
        </View>

        {/* Título y descripción */}
        <Text style={styles.title}>{budget.title}</Text>
        {budget.intro && <Text style={styles.intro}>{budget.intro}</Text>}

        {/* Tabla de partidas */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colConcept]}>Concepto</Text>
            <Text style={[styles.th, styles.colQty]}>Cant.</Text>
            <Text style={[styles.th, styles.colUnit]}>Ud.</Text>
            <Text style={[styles.th, styles.colPrice]}>Precio</Text>
            <Text style={[styles.th, styles.colDisc]}>Dto.</Text>
            <Text style={[styles.th, styles.colTotal]}>Importe</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.td, { flex: 1, textAlign: "center", color: MUTED }]}>Sin partidas</Text>
            </View>
          ) : items.map((it, idx) => {
            const gross = Number(it.quantity) * Number(it.unit_price);
            const discount = gross * (Number(it.discount_pct) / 100);
            const lineTotal = gross - discount;
            const isLast = idx === items.length - 1;
            return (
              <View key={it.id} style={[styles.tableRow, isLast ? styles.tableRowLast : {}]} wrap={false}>
                <View style={[styles.td, styles.colConcept]}>
                  <Text style={styles.conceptName}>{it.concept}</Text>
                  {it.description && <Text style={styles.conceptDesc}>{it.description}</Text>}
                </View>
                <Text style={[styles.td, styles.colQty]}>{Number(it.quantity).toLocaleString("es-ES", { maximumFractionDigits: 2 })}</Text>
                <Text style={[styles.td, styles.colUnit]}>{it.unit ?? "ud"}</Text>
                <Text style={[styles.td, styles.colPrice]}>{eur(Number(it.unit_price))}</Text>
                <Text style={[styles.td, styles.colDisc]}>{Number(it.discount_pct) > 0 ? `-${it.discount_pct}%` : "—"}</Text>
                <Text style={[styles.td, styles.colTotal]}>{eur(lineTotal)}</Text>
              </View>
            );
          })}
        </View>

        {/* Totales */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={{ color: MUTED }}>Subtotal</Text>
              <Text>{eur(totals.subtotal)}</Text>
            </View>
            {totals.totalDiscount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={{ color: MUTED }}>Descuentos</Text>
                <Text>{eur(-totals.totalDiscount)}</Text>
              </View>
            )}
            <View style={[styles.totalsRow, styles.totalsRowBorder]}>
              <Text style={{ color: MUTED }}>Base imponible</Text>
              <Text>{eur(totals.base)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={{ color: MUTED }}>{`IVA (${Number(budget.vat_pct).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%)`}</Text>
              <Text>{eur(totals.vatAmount)}</Text>
            </View>
            <View style={[styles.totalsRowFinal, { marginTop: 6 }]}>
              <Text>TOTAL</Text>
              <Text>{eur(totals.total)}</Text>
            </View>
          </View>
        </View>

        {/* Condiciones de pago */}
        {budget.payment_terms && (
          <View style={styles.conditions}>
            <Text style={styles.conditionsTitle}>Condiciones de pago</Text>
            <Text style={styles.conditionsText}>{budget.payment_terms}</Text>
            {company.iban && (
              <Text style={[styles.conditionsText, { marginTop: 3 }]}>{`IBAN: ${company.iban}`}</Text>
            )}
          </View>
        )}

        {/* Notas legales */}
        {budget.legal_notes && (
          <View style={[styles.conditions, { marginTop: 8 }]}>
            <Text style={styles.conditionsTitle}>Notas</Text>
            <Text style={styles.conditionsText}>{budget.legal_notes}</Text>
          </View>
        )}

        {/* Pie */}
        <View style={styles.footer} fixed>
          <Text>
            {company.legal_name}
            {company.cif ? ` · ${company.cif}` : ""}
            {company.email ? ` · ${company.email}` : ""}
            {company.phone ? ` · ${company.phone}` : ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** Renderiza el PDF a Buffer (uint8array) para devolver desde un Route Handler. */
export async function renderBudgetPdf(props: BudgetPdfProps): Promise<Buffer> {
  return await renderToBuffer(<BudgetPdf {...props} />);
}
