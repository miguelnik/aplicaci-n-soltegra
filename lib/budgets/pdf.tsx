/* eslint-disable jsx-a11y/alt-text */
// ============================================================================
// Generador del PDF del presupuesto — diseño profesional Soltegra.
// Paleta navy + amarillo, tipografía Helvetica, layout en bloques.
// ============================================================================

import {
  renderToBuffer, Document, Page, Text, View, StyleSheet, Image,
  Svg, Path, Rect, Circle, Line,
} from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Budget, BudgetItem, CompanySettings } from "./types";
import { computeBudgetTotals } from "./types";

// ── Paleta ───────────────────────────────────────────────────────────────────
const NAVY       = "#1e2a4a";
const NAVY_DARK  = "#152038";
const YELLOW     = "#d8a32e";
const TEXT       = "#1e2a4a";
const MUTED      = "#6b7280";
const BORDER     = "#e5e7eb";
const BG_OFF     = "#fbfaf6";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingHorizontal: 36,
    paddingBottom: 90,
    fontSize: 9,
    color: TEXT,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },

  // Cabecera con logo centrado
  headerBlock: { alignItems: "center", marginBottom: 8, marginTop: 8 },
  logo: { width: 240, height: 60, objectFit: "contain" },
  tagline: { fontSize: 9, color: MUTED, marginTop: 4, letterSpacing: 0.5 },

  bigTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: NAVY,
    textAlign: "center",
    letterSpacing: 4,
    marginTop: 18,
    fontFamily: "Helvetica-Bold",
  },
  titleAccent: {
    width: 50,
    height: 3,
    backgroundColor: YELLOW,
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 24,
  },

  // Bloques de metadata superior (3 columnas: nº, fecha, cliente)
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: 0.5, borderTopColor: BORDER,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  metaCol: { flexDirection: "row", alignItems: "flex-start", flex: 1, gap: 8 },
  metaIconBox: {
    width: 28, height: 28,
    borderWidth: 1, borderColor: BORDER, borderRadius: 4,
    alignItems: "center", justifyContent: "center",
  },
  metaTextBlock: { flexDirection: "column", justifyContent: "flex-start" },
  metaLabel: {
    fontSize: 7,
    color: MUTED,
    letterSpacing: 1.2,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  metaValue: { fontSize: 10, color: NAVY, fontFamily: "Helvetica-Bold" },
  metaSub:   { fontSize: 8, color: MUTED, marginTop: 1 },

  // Bloques de proyecto (proyecto + ubicación)
  projectRow: {
    flexDirection: "row",
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },

  // Datos fiscales del emisor (5 columnas pequeñas)
  fiscalSection: {
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  fiscalHeader: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 8,
    letterSpacing: 1,
  },
  fiscalGrid: { flexDirection: "row", justifyContent: "space-between" },
  fiscalCol: { flexDirection: "row", alignItems: "flex-start", flex: 1, gap: 6, paddingRight: 6 },
  fiscalLabel: { fontSize: 7, color: MUTED, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  fiscalValue: { fontSize: 8, color: NAVY },

  // Objeto del presupuesto
  objetoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    gap: 12,
  },
  objetoIconBox: {
    width: 34, height: 34,
    backgroundColor: YELLOW,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  objetoTitle: { fontSize: 10, color: NAVY, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, marginBottom: 5 },
  objetoText: { fontSize: 9, color: TEXT, lineHeight: 1.5 },

  // Tabla de partidas
  table: { marginTop: 6, borderRadius: 4, overflow: "hidden", borderWidth: 0.5, borderColor: BORDER },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 8,
  },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 1 },
  thCenter: { textAlign: "center" },
  thRight:  { textAlign: "right" },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 0,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    alignItems: "flex-start",
  },
  tableRowAlt: { backgroundColor: BG_OFF },

  colCode:    { width: 60, paddingLeft: 10, paddingRight: 4 },
  colConcept: { flex: 4, paddingHorizontal: 8 },
  colQty:     { width: 60, textAlign: "center" },
  colPrice:   { width: 80, textAlign: "right", paddingRight: 8 },
  colTotal:   { width: 90, textAlign: "right", paddingRight: 10 },

  itemCode:  { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY },
  itemConcept: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 2 },
  itemDesc:  { fontSize: 8, color: MUTED, lineHeight: 1.4 },
  itemQty:   { fontSize: 9, color: TEXT },
  itemPrice: { fontSize: 9, color: TEXT },
  itemTotal: { fontSize: 9, color: NAVY, fontFamily: "Helvetica-Bold" },

  // Totales y condiciones (lado a lado)
  bottomRow: { flexDirection: "row", marginTop: 14, gap: 14 },

  condBox: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  condIconBox: {
    width: 26, height: 26,
    borderRadius: 13,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  condTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1, marginBottom: 4 },
  condText: { fontSize: 8, color: TEXT, lineHeight: 1.5 },
  condBullet: { fontSize: 8, color: TEXT, lineHeight: 1.4 },

  totalsBlock: { width: 240 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  totalsLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.5 },
  totalsValue: { fontSize: 10, color: TEXT },

  totalRowFinal: {
    flexDirection: "row",
    backgroundColor: NAVY,
    marginTop: 0,
    height: 38,
    alignItems: "center",
  },
  totalLabelFinal: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    letterSpacing: 1.5,
  },
  totalValueFinalWrap: {
    width: 110,
    height: "100%",
    backgroundColor: YELLOW,
    alignItems: "center",
    justifyContent: "center",
  },
  totalValueFinal: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY },

  // Pie navy
  footer: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: NAVY,
    paddingVertical: 14,
    paddingHorizontal: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerCol: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  footerIconBox: {
    width: 22, height: 22,
    borderRadius: 11,
    backgroundColor: YELLOW,
    alignItems: "center", justifyContent: "center",
  },
  footerText: { fontSize: 8, color: "#ffffff" },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const eur = (n: number) => n.toLocaleString("es-ES", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2,
});

const itemCode = (i: number) => `01.${String(i + 1).padStart(2, "0")}`;

// ── Icon helpers (SVG inline para react-pdf) ─────────────────────────────────

const Ico = {
  doc: (color = NAVY, size = 14) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M14 2 L 6 2 a 2 2 0 0 0 -2 2 L 4 20 a 2 2 0 0 0 2 2 L 18 22 a 2 2 0 0 0 2 -2 L 20 8 z" stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M14 2 L 14 8 L 20 8" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  ),
  calendar: (color = NAVY, size = 14) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M16 2 L 16 6 M 8 2 L 8 6 M 3 10 L 21 10" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  ),
  user: (color = NAVY, size = 14) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M20 21 v -2 a 4 4 0 0 0 -4 -4 H 8 a 4 4 0 0 0 -4 4 v 2" stroke={color} strokeWidth={1.6} fill="none" />
      <Circle cx={12} cy={7} r={4} stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  ),
  briefcase: (color = NAVY, size = 14) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2} y={7} width={20} height={14} rx={2} ry={2} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M16 21 V 5 a 2 2 0 0 0 -2 -2 H 10 a 2 2 0 0 0 -2 2 v 16" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  ),
  mapPin: (color = NAVY, size = 14) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M20 10 c 0 7 -8 13 -8 13 s -8 -6 -8 -13 a 8 8 0 0 1 16 0 z" stroke={color} strokeWidth={1.6} fill="none" />
      <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  ),
  info: (color = "#ffffff", size = 14) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M12 16 v -4 M 12 8 h 0.01" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  ),
  phone: (color = NAVY, size = 12) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22 16.92 v 3 a 2 2 0 0 1 -2.18 2 a 19.79 19.79 0 0 1 -8.63 -3.07 a 19.5 19.5 0 0 1 -6 -6 a 19.79 19.79 0 0 1 -3.07 -8.67 A 2 2 0 0 1 4.11 2 h 3 a 2 2 0 0 1 2 1.72 c 0.13 0.96 0.37 1.9 0.7 2.81 a 2 2 0 0 1 -0.45 2.11 L 8.09 9.91 a 16 16 0 0 0 6 6 l 1.27 -1.27 a 2 2 0 0 1 2.11 -0.45 c 0.91 0.33 1.85 0.57 2.81 0.7 A 2 2 0 0 1 22 16.92 z" stroke={color} strokeWidth={1.7} fill="none" />
    </Svg>
  ),
  mail: (color = NAVY, size = 12) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2} y={4} width={20} height={16} rx={2} stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="M2 6 L 12 13 L 22 6" stroke={color} strokeWidth={1.7} fill="none" />
    </Svg>
  ),
  globe: (color = NAVY, size = 12) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="M2 12 H 22 M 12 2 a 15.3 15.3 0 0 1 0 20 M 12 2 a 15.3 15.3 0 0 0 0 20" stroke={color} strokeWidth={1.7} fill="none" />
    </Svg>
  ),
  building: (color = NAVY, size = 12) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={2} width={16} height={20} stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="M9 22 V 18 H 15 V 22 M 9 6 H 9.01 M 15 6 H 15.01 M 9 10 H 9.01 M 15 10 H 15.01 M 9 14 H 9.01 M 15 14 H 15.01" stroke={color} strokeWidth={1.7} fill="none" />
    </Svg>
  ),
};

// ── Decorative corner crosshair (acento técnico discreto) ────────────────────
function CornerMark({ x, y, size = 30, color = YELLOW }: { x: number; y: number; size?: number; color?: string }) {
  return (
    <View style={{ position: "absolute", top: y, left: x, width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} stroke={color} strokeWidth={0.5} fill="none" />
        <Line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke={color} strokeWidth={0.5} />
        <Line x1={size / 2} y1={0} x2={size / 2} y2={size} stroke={color} strokeWidth={0.5} />
      </Svg>
    </View>
  );
}

// ── PDF principal ────────────────────────────────────────────────────────────

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

  const companyAddressLine = [
    company.address_line1,
    [company.postal_code, company.city, company.province].filter(Boolean).join(" "),
  ].filter(Boolean).join("\n");

  const tagline = company.trade_name
    ? company.trade_name
    : "Ingeniería · Arquitectura · Gestión de obras";

  return (
    <Document
      title={`Presupuesto ${budget.number ?? ""}`}
      author={company.legal_name}
      subject="Presupuesto"
    >
      <Page size="A4" style={styles.page}>
        {/* Acentos técnicos en las esquinas */}
        <CornerMark x={12} y={12} />
        <CornerMark x={547} y={12} />

        {/* Logo + tagline + título PRESUPUESTO */}
        <View style={styles.headerBlock}>
          {logoDataUrl ? (
            <Image src={logoDataUrl} style={styles.logo} />
          ) : (
            <Text style={{ fontSize: 28, fontFamily: "Helvetica-Bold", color: NAVY }}>
              {company.legal_name}
            </Text>
          )}
          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        <Text style={styles.bigTitle}>PRESUPUESTO</Text>
        <View style={styles.titleAccent} />

        {/* Meta superior: Nº presupuesto · Fecha · Cliente */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <View style={styles.metaIconBox}>{Ico.doc()}</View>
            <View style={styles.metaTextBlock}>
              <Text style={styles.metaLabel}>Nº PRESUPUESTO</Text>
              <Text style={styles.metaValue}>{budget.number ?? "—"}</Text>
            </View>
          </View>
          <View style={styles.metaCol}>
            <View style={styles.metaIconBox}>{Ico.calendar()}</View>
            <View style={styles.metaTextBlock}>
              <Text style={styles.metaLabel}>FECHA</Text>
              <Text style={styles.metaValue}>{issueDateLabel}</Text>
              {budget.valid_until && (
                <Text style={styles.metaSub}>
                  Válido hasta {format(parseISO(budget.valid_until), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.metaCol}>
            <View style={styles.metaIconBox}>{Ico.user()}</View>
            <View style={styles.metaTextBlock}>
              <Text style={styles.metaLabel}>CLIENTE</Text>
              <Text style={styles.metaValue}>{budget.client_legal_name ?? "—"}</Text>
              {budget.client_cif && (
                <Text style={styles.metaSub}>CIF: {budget.client_cif}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Proyecto + Ubicación */}
        <View style={styles.projectRow}>
          <View style={[styles.metaCol, { flex: 1 }]}>
            <View style={styles.metaIconBox}>{Ico.briefcase()}</View>
            <View style={styles.metaTextBlock}>
              <Text style={styles.metaLabel}>PROYECTO</Text>
              <Text style={styles.metaValue}>{budget.title}</Text>
            </View>
          </View>
          {budget.project_location && (
            <View style={[styles.metaCol, { flex: 1 }]}>
              <View style={styles.metaIconBox}>{Ico.mapPin()}</View>
              <View style={styles.metaTextBlock}>
                <Text style={styles.metaLabel}>UBICACIÓN</Text>
                <Text style={styles.metaValue}>{budget.project_location}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Datos fiscales emisor */}
        <View style={styles.fiscalSection}>
          <Text style={styles.fiscalHeader}>DATOS FISCALES (EMISOR)</Text>
          <View style={styles.fiscalGrid}>
            <View style={styles.fiscalCol}>
              {Ico.user(MUTED, 11)}
              <View>
                <Text style={styles.fiscalLabel}>Razón social</Text>
                <Text style={styles.fiscalValue}>{company.legal_name}</Text>
              </View>
            </View>
            {company.cif && (
              <View style={styles.fiscalCol}>
                {Ico.doc(MUTED, 11)}
                <View>
                  <Text style={styles.fiscalLabel}>CIF</Text>
                  <Text style={styles.fiscalValue}>{company.cif}</Text>
                </View>
              </View>
            )}
            {companyAddressLine && (
              <View style={styles.fiscalCol}>
                {Ico.building(MUTED, 11)}
                <View>
                  <Text style={styles.fiscalLabel}>Domicilio fiscal</Text>
                  <Text style={styles.fiscalValue}>{companyAddressLine}</Text>
                </View>
              </View>
            )}
            {company.phone && (
              <View style={styles.fiscalCol}>
                {Ico.phone(MUTED, 11)}
                <View>
                  <Text style={styles.fiscalLabel}>Teléfono</Text>
                  <Text style={styles.fiscalValue}>{company.phone}</Text>
                </View>
              </View>
            )}
            {company.email && (
              <View style={styles.fiscalCol}>
                {Ico.mail(MUTED, 11)}
                <View>
                  <Text style={styles.fiscalLabel}>Email</Text>
                  <Text style={styles.fiscalValue}>{company.email}</Text>
                </View>
              </View>
            )}
            {company.website && (
              <View style={styles.fiscalCol}>
                {Ico.globe(MUTED, 11)}
                <View>
                  <Text style={styles.fiscalLabel}>Web</Text>
                  <Text style={styles.fiscalValue}>{company.website}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Objeto del presupuesto */}
        {budget.intro && (
          <View style={styles.objetoBox} wrap={false}>
            <View style={styles.objetoIconBox}>{Ico.doc("#ffffff", 18)}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.objetoTitle}>OBJETO DEL PRESUPUESTO</Text>
              <Text style={styles.objetoText}>{budget.intro}</Text>
            </View>
          </View>
        )}

        {/* Tabla de partidas */}
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.th, styles.colCode]}>CONCEPTO</Text>
            <Text style={[styles.th, styles.colConcept]}>DESCRIPCIÓN</Text>
            <Text style={[styles.th, styles.colQty, styles.thCenter]}>CANTIDAD</Text>
            <Text style={[styles.th, styles.colPrice, styles.thRight]}>PRECIO (€)</Text>
            <Text style={[styles.th, styles.colTotal, styles.thRight]}>IMPORTE (€)</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={{ flex: 1, padding: 12, textAlign: "center", color: MUTED, fontSize: 9 }}>
                Sin partidas
              </Text>
            </View>
          ) : items.map((it, idx) => {
            const gross = Number(it.quantity) * Number(it.unit_price);
            const discount = gross * (Number(it.discount_pct) / 100);
            const lineTotal = gross - discount;
            const rowStyle = idx % 2 === 1
              ? [styles.tableRow, styles.tableRowAlt]
              : styles.tableRow;
            return (
              <View key={it.id} style={rowStyle} wrap={false}>
                <View style={styles.colCode}>
                  <Text style={styles.itemCode}>{itemCode(idx)}</Text>
                </View>
                <View style={styles.colConcept}>
                  <Text style={styles.itemConcept}>{it.concept.toUpperCase()}</Text>
                  {it.description && (
                    <Text style={styles.itemDesc}>{it.description}</Text>
                  )}
                </View>
                <Text style={[styles.colQty, styles.itemQty]}>
                  {Number(it.quantity).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={[styles.colPrice, styles.itemPrice]}>
                  {Number(it.unit_price).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </Text>
                <Text style={[styles.colTotal, styles.itemTotal]}>
                  {lineTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Fila inferior: condiciones (izq) + totales (der) */}
        <View style={styles.bottomRow}>
          {/* Condiciones */}
          <View style={styles.condBox}>
            {(budget.payment_terms || budget.legal_notes) && (
              <View style={styles.condIconBox}>{Ico.info("#ffffff", 14)}</View>
            )}
            <View style={{ flex: 1 }}>
              {(budget.payment_terms || budget.legal_notes) && (
                <Text style={styles.condTitle}>CONDICIONES / OBSERVACIONES</Text>
              )}
              {budget.payment_terms && (
                <Text style={styles.condText}>{budget.payment_terms}</Text>
              )}
              {budget.legal_notes && (
                <Text style={[styles.condText, { marginTop: 4 }]}>{budget.legal_notes}</Text>
              )}
              {company.iban && (
                <Text style={[styles.condText, { marginTop: 4 }]}>IBAN: {company.iban}</Text>
              )}
            </View>
          </View>

          {/* Totales */}
          <View style={styles.totalsBlock}>
            <View style={[styles.totalsRow, { borderTopWidth: 0.5, borderTopColor: BORDER }]}>
              <Text style={styles.totalsLabel}>BASE IMPONIBLE</Text>
              <Text style={styles.totalsValue}>{eur(totals.base)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{`IVA (${Number(budget.vat_pct).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%)`}</Text>
              <Text style={styles.totalsValue}>{eur(totals.vatAmount)}</Text>
            </View>
            <View style={styles.totalRowFinal}>
              <Text style={styles.totalLabelFinal}>TOTAL</Text>
              <View style={styles.totalValueFinalWrap}>
                <Text style={styles.totalValueFinal}>{eur(totals.total)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pie navy */}
        <View style={styles.footer} fixed>
          {company.phone && (
            <View style={styles.footerCol}>
              <View style={styles.footerIconBox}>{Ico.phone(NAVY_DARK, 12)}</View>
              <Text style={styles.footerText}>{company.phone}</Text>
            </View>
          )}
          {company.email && (
            <View style={styles.footerCol}>
              <View style={styles.footerIconBox}>{Ico.mail(NAVY_DARK, 12)}</View>
              <Text style={styles.footerText}>{company.email}</Text>
            </View>
          )}
          {company.website && (
            <View style={styles.footerCol}>
              <View style={styles.footerIconBox}>{Ico.globe(NAVY_DARK, 12)}</View>
              <Text style={styles.footerText}>{company.website}</Text>
            </View>
          )}
          {(company.address_line1 || company.city) && (
            <View style={styles.footerCol}>
              <View style={styles.footerIconBox}>{Ico.mapPin(NAVY_DARK, 12)}</View>
              <Text style={styles.footerText}>
                {[company.address_line1, [company.postal_code, company.city].filter(Boolean).join(" ")].filter(Boolean).join("\n")}
              </Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}

/** Renderiza el PDF a Buffer (uint8array) para devolver desde un Route Handler. */
export async function renderBudgetPdf(props: BudgetPdfProps): Promise<Buffer> {
  return await renderToBuffer(<BudgetPdf {...props} />);
}

