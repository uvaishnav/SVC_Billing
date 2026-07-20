/**
 * InvoicePdf.tsx
 * Complete GST invoice document using @react-pdf/renderer.
 * Implements the final consolidated design spec.
 *
 * Layout order (per spec §18):
 *   1. Supplier header band
 *   2. GSTIN strip (full-width ESPRESSO bar, centered GSTIN — header bottom border)
 *   3. TAX INVOICE stamp (slim centered label)
 *   4. Two-column block: INVOICE DETAILS (incl. invoice no.) | DETAILS OF RECIPIENT OF SERVICE
 *   5. Description of Services
 *   6. SAC code tab + Main table (quantity OR rental) — SAC sits as a bump on the table
 *   7. Work Items Covered block (rental only, conditional)
 *   8. Tax / totals summary
 *   9. Amount in words
 *  10. Footer: bank details | signature
 *
 * Invoice Details row order:
 *   Invoice No. → Invoice Date → Billing Period → State Code (supplier) →
 *   Reverse Charge → Place of Supply → Work Order Ref
 *
 * Recipient block:
 *   Name → GSTIN → Address → State (separate row) → State Code (separate row)
 */


import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import {
  ESPRESSO, BODY_TEXT, MUTED,
  CREAM, DIVIDER, WHITE,
  GOLD_ACCENT, GOLD_CHIP_BG,
  STEEL_ACCENT, STEEL_CHIP_BG,
  QTY_TABLE_HEADER_BG, RENTAL_TABLE_HEADER_BG,
  formatCurrency, formatDate,
} from './pdfUtils';
import type { InvoicePdfProps } from './invoicePayloadTypes';

// ── Font registration ─────────────────────────────────────────────────────────
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin-400-normal.ttf', fontWeight: 400, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin-500-normal.ttf', fontWeight: 500, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin-600-normal.ttf', fontWeight: 600, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin-700-normal.ttf', fontWeight: 700, fontStyle: 'normal' },
  ],
});

Font.register({
  family: 'Lora',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lora@5/latin-400-normal.ttf', fontWeight: 400, fontStyle: 'normal' },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/lora@5/latin-700-normal.ttf', fontWeight: 700, fontStyle: 'normal' },
  ],
});

// ── Page constants ────────────────────────────────────────────────────────────
const PAGE_MARGIN  = 32;
const BODY_FONT    = 'Inter';
const HEAD_FONT    = 'Lora';

const HEADER_PADDING_V = 0;
const LOGO_SIZE        = 100;
const LOGO_MARGIN      = 0;

// Thin warm separator between CREAM header and ESPRESSO GSTIN strip
const GSTIN_STRIP_BORDER = '#9E865A';

// Standard GST invoice declaration (Rule 46, CGST Rules 2017)
const GST_DECLARATION =
  'We hereby certify that the goods/services mentioned in this invoice are true ' +
  'and correct and the amount indicated represents the price actually charged and ' +
  'that there is no additional consideration flowing from the buyer.';

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: BODY_FONT,
    fontSize: 8,
    color: BODY_TEXT,
    backgroundColor: WHITE,
    paddingTop: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN + 12,
    paddingHorizontal: PAGE_MARGIN,
    lineHeight: 1.4,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: CREAM,
    paddingVertical: HEADER_PADDING_V,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoWrap: {
    margin: LOGO_MARGIN,
    marginRight: 0,
    marginLeft: 0,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerLogo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    objectFit: 'contain',
  },
  headerLogoPlaceholder: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    backgroundColor: '#E8E2D8',
    borderRadius: 4,
  },
  headerTextBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  headerBusinessName: {
    fontFamily: HEAD_FONT,
    fontSize: 18,
    fontWeight: 700,
    color: ESPRESSO,
    lineHeight: 1.0,
    marginBottom: 4,
  },
  headerAddress: {
    fontSize: 7.5,
    color: BODY_TEXT,
    lineHeight: 1.2,
    marginBottom: 5,
  },
  headerMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  headerMetaItem: {
    fontSize: 6.8,
    color: MUTED,
  },
  headerMetaDivider: {
    fontSize: 6.8,
    color: DIVIDER,
    marginHorizontal: 4,
  },

  // ── GSTIN Strip ───────────────────────────────────────────────────────────
  gstinStrip: {
    backgroundColor: ESPRESSO,
    marginTop: -14,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: GSTIN_STRIP_BORDER,
  },
  gstinStripText: {
    fontSize: 8.5,
    fontWeight: 700,
    color: CREAM,
    letterSpacing: 2,
  },
  gstinStripSpacer: {
    fontSize: 8.5,
    fontWeight: 400,
    color: GSTIN_STRIP_BORDER,
    marginHorizontal: 6,
  },

  // ── TAX INVOICE stamp ──────────────────────────────────────────────────────
  taxInvoiceStamp: {
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
  },
  taxInvoiceStampText: {
    fontFamily: HEAD_FONT,
    fontSize: 11,
    fontWeight: 700,
    color: ESPRESSO,
    letterSpacing: 2,
  },

  // ── Two-column metadata ────────────────────────────────────────────────────
  twoCol: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
  },
  twoColLeft: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: DIVIDER,
  },
  twoColRight: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 10,
  },
  colSectionLabel: {
    fontSize: 6.5,
    fontWeight: 700,
    color: MUTED,
    letterSpacing: 0.8,
    marginBottom: 6,
    borderBottomWidth: 0.75,
    borderBottomColor: DIVIDER,
    paddingBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 7,
    color: MUTED,
    width: 90,
    flexShrink: 0,
  },
  metaValue: {
    fontSize: 7,
    color: BODY_TEXT,
    flex: 1,
  },
  metaValueStrong: {
    fontSize: 7.5,
    fontWeight: 600,
    color: ESPRESSO,
    flex: 1,
  },
  invoiceNumberValue: {
    fontSize: 8.5,
    fontWeight: 700,
    color: ESPRESSO,
    flex: 1,
    letterSpacing: 0.3,
  },

  // ── SAC tab ────────────────────────────────────────────────────────────────
  sacTabWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 0,
  },
  sacTab: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderTopWidth: 1.0,
    borderLeftWidth: 1.0,
    borderRightWidth: 1.0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  sacTabLabel: {
    fontSize: 7.5,
    fontWeight: 600,
    color: MUTED,
    letterSpacing: 0.5,
    marginRight: 4,
    textTransform: 'uppercase',
  },
  sacTabValue: {
    fontSize: 7.5,
    fontWeight: 700,
    color: ESPRESSO,
    letterSpacing: 0.5,
  },

  // ── Description block ─────────────────────────────────────────────────────
  descBlock: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    marginBottom: 4,
  },
  descLabel: {
    fontSize: 6.5,
    fontWeight: 700,
    color: MUTED,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  descText: {
    fontSize: 7.5,
    color: BODY_TEXT,
    lineHeight: 1.5,
  },

  // ── Table shared ──────────────────────────────────────────────────────────
  table: {
    width: '100%',
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderTopWidth: 1.0,
    borderBottomWidth: 1.0,
    borderColor: DIVIDER,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: 700,
    color: ESPRESSO,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.75,
    borderBottomColor: DIVIDER,
  },
  tableRowAlt: {
    backgroundColor: '#F9F7F3',
  },
  tableCell: {
    fontSize: 7.5,
    color: BODY_TEXT,
  },
  dayNightBadge: {
    marginTop: 3,
    backgroundColor: '#EBF8F2',
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 0.8,
    borderRadius: 2.5,
    borderWidth: 0.75,
    borderColor: '#86CBA0',
    alignSelf: 'flex-start',
  },
  dayNightBadgeText: {
    fontFamily: BODY_FONT,
    fontSize: 4.8,
    fontWeight: 700,
    color: '#0F5132',
    lineHeight: 1.0,
    letterSpacing: 0.2,
  },
  tableCellRight: {
    fontSize: 7.5,
    color: BODY_TEXT,
    textAlign: 'right',
  },
  tableCellMuted: {
    fontSize: 7,
    color: MUTED,
  },
  tableTaxableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 1.0,
    borderBottomColor: '#9E865A',
  },
  tableTaxableLabel: {
    fontSize: 7.5,
    fontWeight: 600,
    color: ESPRESSO,
  },
  tableTaxableAmount: {
    fontSize: 7.5,
    fontWeight: 600,
    color: ESPRESSO,
    textAlign: 'right',
  },

  // ── Quantity table column widths ──────────────────────────────────────────
  qColSl:   { width: '6%' },
  qColDesc: { width: '40%' },
  qColUnit: { width: '12%', textAlign: 'center' },
  qColQty:  { width: '12%', textAlign: 'right' },
  qColRate: { width: '15%', textAlign: 'right' },
  qColAmt:  { width: '15%', textAlign: 'right' },

  // ── Rental table column widths ────────────────────────────────────────────
  rColSl:     { width: '5%' },
  rColVeh:    { width: '14%' },
  rColType:   { width: '10%' },
  rColPeriod: { width: '20%' },
  rColMode:   { width: '13%' },
  rColDays:   { width: '7%',  textAlign: 'right' },
  rColRent:   { width: '16%', textAlign: 'right' },
  rColAmt:    { width: '15%', textAlign: 'right' },

  // ── Work items block ──────────────────────────────────────────────────────
  workItemsBlock: {
    backgroundColor: '#F7F5F0',
    borderWidth: 1.0,
    borderColor: DIVIDER,
    borderRadius: 3,
    padding: 8,
    marginBottom: 8,
  },
  workItemsLabel: {
    fontSize: 6.5,
    fontWeight: 700,
    color: MUTED,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  workItemRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  workItemBullet: {
    fontSize: 7.5,
    color: MUTED,
    marginRight: 5,
  },
  workItemText: {
    fontSize: 7.5,
    color: BODY_TEXT,
    flex: 1,
  },

  // ── Totals section ────────────────────────────────────────────────────────
  totalsSection: {
    marginBottom: 8,
    marginLeft: '50%',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 0.75,
    borderBottomColor: DIVIDER,
  },
  totalsLabel: {
    fontSize: 7.5,
    color: MUTED,
  },
  totalsValue: {
    fontSize: 7.5,
    color: BODY_TEXT,
    textAlign: 'right',
  },
  totalsLabelStrong: {
    fontSize: 7.5,
    fontWeight: 600,
    color: ESPRESSO,
  },
  totalsValueStrong: {
    fontSize: 7.5,
    fontWeight: 600,
    color: ESPRESSO,
    textAlign: 'right',
  },
  netReceivableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: ESPRESSO,
    borderRadius: 3,
    marginTop: 2,
  },
  netReceivableLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: CREAM,
  },
  netReceivableValue: {
    fontSize: 8,
    fontWeight: 700,
    color: CREAM,
    textAlign: 'right',
  },

  // ── Amount in words ───────────────────────────────────────────────────────
  amountInWords: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#F4F1EC',
    borderWidth: 1.0,
    borderColor: DIVIDER,
    borderRadius: 3,
    marginBottom: 10,
  },
  amountInWordsLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: MUTED,
    marginRight: 4,
    letterSpacing: 0.5,
  },
  amountInWordsValue: {
    fontSize: 7.5,
    color: ESPRESSO,
    flex: 1,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
    paddingTop: 10,
    marginTop: 4,
  },
  footerLeft: {
    flex: 1,
    paddingRight: 12,
    borderRightWidth: 1.0,
    borderRightColor: DIVIDER,
  },
  footerRight: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerSectionLabel: {
    fontSize: 6.5,
    fontWeight: 700,
    color: MUTED,
    letterSpacing: 0.8,
    marginBottom: 6,
    borderBottomWidth: 0.75,
    borderBottomColor: DIVIDER,
    paddingBottom: 3,
  },
  footerBankRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  footerBankLabel: {
    fontSize: 7,
    color: MUTED,
    width: 72,
    flexShrink: 0,
  },
  footerBankValue: {
    fontSize: 7,
    color: BODY_TEXT,
    fontWeight: 500,
    flex: 1,
  },
  footerDeclaration: {
    fontSize: 6.5,
    color: MUTED,
    lineHeight: 1.5,
    textAlign: 'left',
  },
  footerSignatureBlock: {
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  footerSignatureLine: {
    borderTopWidth: 1.0,
    borderTopColor: DIVIDER,
    width: 100,
    marginBottom: 3,
  },
  footerSignatoryLabel: {
    fontSize: 7,
    color: MUTED,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  footerSignatoryName: {
    fontSize: 8,
    fontWeight: 700,
    color: ESPRESSO,
    letterSpacing: 0.3,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function accentColor(taxMode: 'cgst_sgst' | 'igst') {
  return taxMode === 'igst' ? STEEL_ACCENT : GOLD_ACCENT;
}
function chipBg(taxMode: 'cgst_sgst' | 'igst') {
  return taxMode === 'igst' ? STEEL_CHIP_BG : GOLD_CHIP_BG;
}
function formatBillingPeriod(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function formatBillingMode(mode: string): string {
  switch (mode) {
    case 'full_month':   return 'Full Month';
    case 'partial_days': return 'Partial Days';
    default:
      return mode
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeaderBand({ supplier }: { supplier: InvoicePdfProps['supplier'] }) {
  return (
    <View style={s.header}>
      <View style={s.headerLogoWrap}>
        {supplier.logo_url ? (
          <Image src={supplier.logo_url} style={s.headerLogo} />
        ) : (
          <View style={s.headerLogoPlaceholder} />
        )}
      </View>
      <View style={s.headerTextBlock}>
        <Text style={s.headerBusinessName}>{supplier.business_name}</Text>
        <Text style={s.headerAddress}>{supplier.address}</Text>
        <View style={s.headerMetaLine}>
          <Text style={s.headerMetaItem}>PAN: {supplier.pan}</Text>
          <Text style={s.headerMetaDivider}>|</Text>
          <Text style={s.headerMetaItem}>State: {supplier.state} ({supplier.state_code})</Text>
          <Text style={s.headerMetaDivider}>|</Text>
          <Text style={s.headerMetaItem}>Ph: {supplier.phone}</Text>
          <Text style={s.headerMetaDivider}>|</Text>
          <Text style={s.headerMetaItem}>{supplier.email}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Full-width ESPRESSO strip — seals the header band.
 * A warm muted · dot separates label from number.
 */
function GstinStrip({ gstin }: { gstin: string }) {
  return (
    <View style={s.gstinStrip}>
      <Text style={s.gstinStripText}>GSTIN</Text>
      <Text style={s.gstinStripSpacer}>·</Text>
      <Text style={s.gstinStripText}>{gstin}</Text>
    </View>
  );
}

function TaxInvoiceStamp({ taxMode }: { taxMode: 'cgst_sgst' | 'igst' }) {
  return (
    <View style={[s.taxInvoiceStamp, { borderBottomColor: accentColor(taxMode) }]}>
      <Text style={[s.taxInvoiceStampText, { color: accentColor(taxMode) }]}>
        TAX INVOICE
      </Text>
    </View>
  );
}

/**
 * TwoColumnMeta
 *
 * LEFT — INVOICE DETAILS
 *   Row order: Invoice No. → Invoice Date → Billing Period →
 *              State Code (supplier's own state code from settings) →
 *              Reverse Charge → Place of Supply → Work Order Ref
 *
 * RIGHT — DETAILS OF RECIPIENT OF SERVICE
 *   Row order: Name → GSTIN → Address → State → State Code
 *   State and State Code are in SEPARATE rows (not combined).
 */
function TwoColumnMeta({ props }: { props: InvoicePdfProps }) {
  const {
    invoice_number, invoice_date, billing_from, billing_to,
    place_of_supply, supplier_state_code,
    reverse_charge, work_order_reference, recipient,
  } = props;
  return (
    <View style={s.twoCol}>
      {/* ── LEFT: Invoice Details ── */}
      <View style={s.twoColLeft}>
        <Text style={s.colSectionLabel}>INVOICE DETAILS</Text>

        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Invoice No.</Text>
          <Text style={s.invoiceNumberValue}>{invoice_number}</Text>
        </View>

        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Invoice Date</Text>
          <Text style={s.metaValue}>{formatDate(invoice_date)}</Text>
        </View>

        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Billing Period</Text>
          <Text style={s.metaValue}>{formatBillingPeriod(billing_from, billing_to)}</Text>
        </View>

        {/* State Code = supplier's own registration state code, always from settings */}
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>State Code</Text>
          <Text style={s.metaValue}>{supplier_state_code}</Text>
        </View>

        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Reverse Charge</Text>
          <Text style={s.metaValue}>{reverse_charge ? 'Yes' : 'No'}</Text>
        </View>

        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Place of Supply</Text>
          <Text style={s.metaValue}>{place_of_supply}</Text>
        </View>

        {work_order_reference ? (
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Work Order Ref</Text>
            <Text style={s.metaValue}>{work_order_reference}</Text>
          </View>
        ) : null}
      </View>

      {/* ── RIGHT: Recipient Details ── */}
      <View style={s.twoColRight}>
        <Text style={s.colSectionLabel}>DETAILS OF RECIPIENT OF SERVICE</Text>
        {recipient ? (
          <View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Name</Text>
              <Text style={s.metaValueStrong}>{recipient.name}</Text>
            </View>
            {recipient.gstin ? (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>GSTIN</Text>
                <Text style={s.metaValue}>{recipient.gstin}</Text>
              </View>
            ) : null}
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Address</Text>
              <Text style={s.metaValue}>{recipient.address}</Text>
            </View>
            {/* State and State Code as SEPARATE rows */}
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>State</Text>
              <Text style={s.metaValue}>{recipient.state}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>State Code</Text>
              <Text style={s.metaValue}>{recipient.state_code}</Text>
            </View>
          </View>
        ) : (
          <Text style={s.tableCellMuted}>Unregistered Recipient</Text>
        )}
      </View>
    </View>
  );
}

function DescriptionBlock({ description }: { description: string }) {
  if (!description) return null;
  return (
    <View style={s.descBlock}>
      <Text style={s.descLabel}>DESCRIPTION OF SERVICES</Text>
      <Text style={s.descText}>{description}</Text>
    </View>
  );
}

function SacTab({ sacCode, taxMode }: { sacCode: string; taxMode: 'cgst_sgst' | 'igst' }) {
  return (
    <View style={s.sacTabWrap}>
      <View style={[
        s.sacTab,
        {
          backgroundColor: chipBg(taxMode),
          borderTopColor: accentColor(taxMode),
          borderLeftColor: accentColor(taxMode),
          borderRightColor: accentColor(taxMode),
        },
      ]}>
        <Text style={s.sacTabLabel}>SAC CODE :</Text>
        <Text style={s.sacTabValue}>{sacCode}</Text>
      </View>
    </View>
  );
}

function QuantityTable({
  lineItems,
  totalTaxable,
  taxMode,
  sacCode,
}: {
  lineItems: InvoicePdfProps['line_items'];
  totalTaxable: number;
  taxMode: 'cgst_sgst' | 'igst';
  sacCode?: string | null;
}) {
  return (
    <View style={s.table}>
      {sacCode ? <SacTab sacCode={sacCode} taxMode={taxMode} /> : null}
      <View style={[s.tableHeaderRow, { backgroundColor: QTY_TABLE_HEADER_BG }]}>
        <Text style={[s.tableHeaderCell, s.qColSl]}>Sl.</Text>
        <Text style={[s.tableHeaderCell, s.qColDesc]}>Description of Service</Text>
        <Text style={[s.tableHeaderCell, s.qColUnit]}>Unit</Text>
        <Text style={[s.tableHeaderCell, s.qColQty]}>Qty</Text>
        <Text style={[s.tableHeaderCell, s.qColRate]}>Rate (Rs.)</Text>
        <Text style={[s.tableHeaderCell, s.qColAmt]}>Amount (Rs.)</Text>
      </View>
      {lineItems.map((item, idx) => (
        <View key={item.sl_no} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={[s.tableCell, s.qColSl]}>{item.sl_no}</Text>
          <Text style={[s.tableCell, s.qColDesc]}>{item.description}</Text>
          <Text style={[s.tableCell, s.qColUnit]}>{item.unit}</Text>
          <Text style={[s.tableCellRight, s.qColQty]}>{item.qty.toFixed(2)}</Text>
          <Text style={[s.tableCellRight, s.qColRate]}>{formatCurrency(item.rate)}</Text>
          <Text style={[s.tableCellRight, s.qColAmt]}>{formatCurrency(item.amount)}</Text>
        </View>
      ))}
      <View style={s.tableTaxableRow}>
        <Text style={[s.tableTaxableLabel, s.qColSl]} />
        <Text style={[s.tableTaxableLabel, s.qColDesc]}>Taxable Value</Text>
        <Text style={[s.tableTaxableLabel, s.qColUnit]} />
        <Text style={[s.tableTaxableLabel, s.qColQty]} />
        <Text style={[s.tableTaxableLabel, s.qColRate]} />
        <Text style={[s.tableTaxableAmount, s.qColAmt]}>{formatCurrency(totalTaxable)}</Text>
      </View>
    </View>
  );
}

function RentalTable({
  rentalItems,
  totalTaxable,
  taxMode,
  sacCode,
}: {
  rentalItems: InvoicePdfProps['rental_items'];
  totalTaxable: number;
  taxMode: 'cgst_sgst' | 'igst';
  sacCode?: string | null;
}) {
  return (
    <View style={s.table}>
      {sacCode ? <SacTab sacCode={sacCode} taxMode={taxMode} /> : null}
      <View style={[s.tableHeaderRow, { backgroundColor: RENTAL_TABLE_HEADER_BG }]}>
        <Text style={[s.tableHeaderCell, s.rColSl]}>Sl.</Text>
        <Text style={[s.tableHeaderCell, s.rColVeh]}>Vehicle No</Text>
        <Text style={[s.tableHeaderCell, s.rColType]}>Type</Text>
        <Text style={[s.tableHeaderCell, s.rColPeriod]}>Billing Period</Text>
        <Text style={[s.tableHeaderCell, s.rColMode]}>Billing Mode</Text>
        <Text style={[s.tableHeaderCell, s.rColDays]}>Days</Text>
        <Text style={[s.tableHeaderCell, s.rColRent]}>Monthly Rent (Rs.)</Text>
        <Text style={[s.tableHeaderCell, s.rColAmt]}>Amount (Rs.)</Text>
      </View>
      {rentalItems.map((item, idx) => (
        <View key={item.sl_no} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={[s.tableCell, s.rColSl]}>{item.sl_no}</Text>
          <Text style={[s.tableCell, s.rColVeh]}>{item.reg_number}</Text>
          <Text style={[s.tableCell, s.rColType]}>{item.vehicle_type}</Text>
          <Text style={[s.tableCell, s.rColPeriod]}>
            {formatDate(item.billing_from)} – {formatDate(item.billing_to)}
          </Text>
          <View style={[s.rColMode, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={s.tableCell}>{formatBillingMode(item.billing_mode)}</Text>
            {item.day_night_shift && (
              <View style={s.dayNightBadge}>
                <Text style={s.dayNightBadgeText}>DAY + NIGHT</Text>
              </View>
            )}
          </View>
          <Text style={[s.tableCellRight, s.rColDays]}>
            {item.billing_mode === 'full_month' ? '–' : (item.num_days ?? '–')}
          </Text>
          <Text style={[s.tableCellRight, s.rColRent]}>{formatCurrency(item.monthly_rent)}</Text>
          <Text style={[s.tableCellRight, s.rColAmt]}>{formatCurrency(item.amount)}</Text>
        </View>
      ))}
      <View style={s.tableTaxableRow}>
        <Text style={[s.tableTaxableLabel, s.rColSl]} />
        <Text style={[s.tableTaxableLabel, s.rColVeh]}>Taxable Value</Text>
        <Text style={[s.tableTaxableLabel, s.rColType]} />
        <Text style={[s.tableTaxableLabel, s.rColPeriod]} />
        <Text style={[s.tableTaxableLabel, s.rColMode]} />
        <Text style={[s.tableTaxableLabel, s.rColDays]} />
        <Text style={[s.tableTaxableLabel, s.rColRent]} />
        <Text style={[s.tableTaxableAmount, s.rColAmt]}>{formatCurrency(totalTaxable)}</Text>
      </View>
    </View>
  );
}

function WorkItemsBlock({ items }: { items: InvoicePdfProps['item_distribution'] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={s.workItemsBlock}>
      <Text style={s.workItemsLabel}>WORK ITEMS COVERED UNDER THIS BILLING PERIOD</Text>
      {items.map((item, idx) => (
        <View key={idx} style={s.workItemRow}>
          <Text style={s.workItemBullet}>–</Text>
          <Text style={s.workItemText}>
            {item.description}
            {item.sub_work_ref ? ` (Sub-ref: ${item.sub_work_ref})` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * TotalsSection
 *
 * Renders the billing summary: taxable amount, GST split (CGST+SGST or IGST),
 * total amount, TDS deduction, net receivable, and amount in words.
 */
function TotalsSection({ props }: { props: InvoicePdfProps }) {
  const {
    total_taxable, gst_rate, tax_mode,
    total_gst, total_amount, tds_rate, tds_amount,
    net_receivable, amount_in_words,
  } = props;
  const halfRate = gst_rate / 2;

  return (
    <>
      <View style={s.totalsSection}>
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Taxable Amount</Text>
          <Text style={s.totalsValue}>Rs. {formatCurrency(total_taxable)}</Text>
        </View>
        {tax_mode === 'cgst_sgst' ? (
          <View>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>CGST @ {halfRate}%</Text>
              <Text style={s.totalsValue}>Rs. {formatCurrency(total_gst / 2)}</Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>SGST @ {halfRate}%</Text>
              <Text style={s.totalsValue}>Rs. {formatCurrency(total_gst / 2)}</Text>
            </View>
          </View>
        ) : (
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>IGST @ {gst_rate}%</Text>
            <Text style={s.totalsValue}>Rs. {formatCurrency(total_gst)}</Text>
          </View>
        )}
        <View style={[s.totalsRow, { borderTopWidth: 1.0, borderTopColor: DIVIDER }]}>
          <Text style={s.totalsLabelStrong}>Total Amount</Text>
          <Text style={s.totalsValueStrong}>Rs. {formatCurrency(total_amount)}</Text>
        </View>
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Less: TDS @ {tds_rate}%</Text>
          <Text style={s.totalsValue}>- Rs. {formatCurrency(tds_amount)}</Text>
        </View>
        <View style={s.netReceivableRow}>
          <Text style={s.netReceivableLabel}>Net Receivable</Text>
          <Text style={s.netReceivableValue}>Rs. {formatCurrency(net_receivable)}</Text>
        </View>
      </View>
      <View style={s.amountInWords}>
        <Text style={s.amountInWordsLabel}>AMOUNT IN WORDS :</Text>
        <Text style={s.amountInWordsValue}>{amount_in_words}</Text>
      </View>
    </>
  );
}

function FooterSection({ props }: { props: InvoicePdfProps }) {
  const { supplier, bank } = props;
  return (
    <View style={s.footer}>
      <View style={s.footerLeft}>
        <Text style={s.footerSectionLabel}>BANK DETAILS</Text>
        {bank ? (
          <View>
            <View style={s.footerBankRow}>
              <Text style={s.footerBankLabel}>Bank Name</Text>
              <Text style={s.footerBankValue}>{bank.bank_name}</Text>
            </View>
            <View style={s.footerBankRow}>
              <Text style={s.footerBankLabel}>Account Name</Text>
              <Text style={s.footerBankValue}>{bank.account_name}</Text>
            </View>
            <View style={s.footerBankRow}>
              <Text style={s.footerBankLabel}>Account No.</Text>
              <Text style={s.footerBankValue}>{bank.account_number}</Text>
            </View>
            <View style={s.footerBankRow}>
              <Text style={s.footerBankLabel}>IFSC Code</Text>
              <Text style={s.footerBankValue}>{bank.ifsc}</Text>
            </View>
            {bank.branch ? (
              <View style={s.footerBankRow}>
                <Text style={s.footerBankLabel}>Branch</Text>
                <Text style={s.footerBankValue}>{bank.branch}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={s.tableCellMuted}>No bank details on file.</Text>
        )}
      </View>

      <View style={s.footerRight}>
        <Text style={s.footerDeclaration}>{GST_DECLARATION}</Text>
        <View style={s.footerSignatureBlock}>
          <View style={s.footerSignatureLine} />
          <Text style={s.footerSignatoryLabel}>Authorised Signatory</Text>
          {supplier.authorized_signatory ? (
            <Text style={s.footerSignatoryName}>{supplier.authorized_signatory}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── Main Document ─────────────────────────────────────────────────────────────

export function InvoicePdf(props: InvoicePdfProps) {
  const {
    billing_type, tax_mode, sac_code,
    line_items, rental_items, item_distribution,
    total_taxable,
  } = props;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <HeaderBand supplier={props.supplier} />
        <GstinStrip gstin={props.supplier.gstin} />
        <TaxInvoiceStamp taxMode={tax_mode} />
        <TwoColumnMeta props={props} />
        <DescriptionBlock description={props.overall_description} />

        {billing_type === 'rental' ? (
          <RentalTable
            rentalItems={rental_items ?? []}
            totalTaxable={total_taxable}
            taxMode={tax_mode}
            sacCode={sac_code}
          />
        ) : (
          <QuantityTable
            lineItems={line_items ?? []}
            totalTaxable={total_taxable}
            taxMode={tax_mode}
            sacCode={sac_code}
          />
        )}

        <WorkItemsBlock items={item_distribution} />
        <TotalsSection props={props} />
        <FooterSection props={props} />
      </Page>
    </Document>
  );
}
