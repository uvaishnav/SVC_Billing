/**
 * InvoicePdf.tsx
 * Complete GST invoice document using @react-pdf/renderer.
 * Implements the final consolidated design spec.
 *
 * Layout order (per spec §18):
 *   1. Supplier header band
 *   2. TAX INVOICE stamp (slim centered label)
 *   3. Two-column block: INVOICE DETAILS (incl. invoice no.) | DETAILS OF RECIPIENT OF SERVICE
 *   4. SAC code strip
 *   5. Description of Services
 *   6. Main table (quantity OR rental)
 *   7. Work Items Covered block (rental only, conditional)
 *   8. Tax / totals summary
 *   9. Amount in words
 *  10. Footer: bank details | signature
 */

import React from 'react';
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

/**
 * Header geometry constants.
 * HEADER_PADDING_V  — vertical padding inside the cream band
 * LOGO_SIZE         — logo renders at exactly this square (≈80% of band height)
 *   Band inner height ≈ LOGO_SIZE + 2 × LOGO_MARGIN, so the logo fills 80% visually.
 * LOGO_MARGIN       — equal whitespace on all four sides of the logo
 */
const HEADER_PADDING_V = 8;
const LOGO_SIZE        = 52;   // px — logo image square
const LOGO_MARGIN      = 6;    // px — equal breathing room around logo on all sides

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
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',          // vertically centre logo column vs text column
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
  },

  /**
   * Logo column:
   *  - Fixed square = LOGO_SIZE
   *  - Equal margin on all 4 sides = LOGO_MARGIN
   *  - Total column width = LOGO_SIZE + 2×LOGO_MARGIN (auto via margin props)
   */
  headerLogoWrap: {
    margin: LOGO_MARGIN,
    marginRight: LOGO_MARGIN + 10,  // a little extra gutter before text
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

  /**
   * Text column:
   *  - flex: 1  → expands to fill all remaining width after the logo
   *  - justifyContent: 'center' → vertically centres the name+address+meta stack
   */
  headerTextBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  headerBusinessName: {
    fontFamily: HEAD_FONT,
    fontSize: 15,
    fontWeight: 700,
    color: ESPRESSO,
    marginBottom: 1,
  },
  headerAddress: {
    fontSize: 7.5,
    color: BODY_TEXT,
    marginBottom: 5,             // breathing room between address and meta row
  },
  /**
   * Single meta row: GSTIN | PAN | State | Ph | Email
   * All on one line — uses full available width.
   */
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

  // ── TAX INVOICE stamp — slim centered label, no box ────────────────────────
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
    borderBottomWidth: 0.5,
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

  // ── SAC strip ──────────────────────────────────────────────────────────────
  sacStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 0.75,
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 6,
  },
  sacLabel: {
    fontSize: 7,
    color: MUTED,
    marginRight: 8,
    letterSpacing: 0.6,
  },
  sacValue: {
    fontSize: 8.5,
    fontWeight: 700,
    color: ESPRESSO,
    letterSpacing: 1,
  },

  // ── Description block ──────────────────────────────────────────────────────
  descBlock: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    marginBottom: 8,
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

  // ── Table shared ───────────────────────────────────────────────────────────
  table: {
    width: '100%',
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
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
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
  },
  tableRowAlt: {
    backgroundColor: '#F9F7F3',
  },
  tableCell: {
    fontSize: 7.5,
    color: BODY_TEXT,
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
    borderTopWidth: 1,
    borderTopColor: '#C8B89A',
    marginTop: 2,
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

  // ── Quantity table column widths ───────────────────────────────────────────
  qColSl:   { width: '6%' },
  qColDesc: { width: '40%' },
  qColUnit: { width: '12%', textAlign: 'center' },
  qColQty:  { width: '12%', textAlign: 'right' },
  qColRate: { width: '15%', textAlign: 'right' },
  qColAmt:  { width: '15%', textAlign: 'right' },

  // ── Rental table column widths ─────────────────────────────────────────────
  rColSl:     { width: '5%' },
  rColVeh:    { width: '14%' },
  rColType:   { width: '10%' },
  rColPeriod: { width: '20%' },
  rColMode:   { width: '13%' },
  rColDays:   { width: '7%',  textAlign: 'right' },
  rColRent:   { width: '16%', textAlign: 'right' },
  rColAmt:    { width: '15%', textAlign: 'right' },

  // ── Work items block ───────────────────────────────────────────────────────
  workItemsBlock: {
    backgroundColor: '#F7F5F0',
    borderWidth: 0.75,
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

  // ── Totals section ─────────────────────────────────────────────────────────
  totalsSection: {
    marginBottom: 8,
    marginLeft: '50%',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
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

  // ── Amount in words ────────────────────────────────────────────────────────
  amountInWords: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#F4F1EC',
    borderWidth: 0.75,
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

  // ── Footer ─────────────────────────────────────────────────────────────────
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
    borderRightWidth: 0.75,
    borderRightColor: DIVIDER,
  },
  footerRight: {
    flex: 1,
    paddingLeft: 12,
    alignItems: 'flex-start',
  },
  footerSectionLabel: {
    fontSize: 6.5,
    fontWeight: 700,
    color: MUTED,
    letterSpacing: 0.8,
    marginBottom: 6,
    borderBottomWidth: 0.5,
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
  footerForText: {
    fontSize: 7.5,
    fontWeight: 600,
    color: ESPRESSO,
    marginBottom: 4,
  },
  footerSignatureLine: {
    borderTopWidth: 0.75,
    borderTopColor: DIVIDER,
    width: 100,
    marginBottom: 3,
  },
  footerSignatoryLabel: {
    fontSize: 7,
    color: MUTED,
    letterSpacing: 0.5,
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

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * HeaderBand
 *
 * Layout:
 *   [LOGO 52×52, equal margin 6px on all sides]  [Text block — flex:1]
 *
 * Text block (vertically centered beside logo):
 *   Business Name  (Lora 15pt bold)
 *   Address        (Inter 7.5pt)
 *   ── single meta line ──
 *   GSTIN: xxx | PAN: xxx | State: xxx (xx) | Ph: xxx | email
 */
function HeaderBand({ supplier }: { supplier: InvoicePdfProps['supplier'] }) {
  return (
    <View style={s.header}>
      {/* ── Logo column ── */}
      <View style={s.headerLogoWrap}>
        {supplier.logo_url ? (
          <Image src={supplier.logo_url} style={s.headerLogo} />
        ) : (
          <View style={s.headerLogoPlaceholder} />
        )}
      </View>

      {/* ── Text column ── */}
      <View style={s.headerTextBlock}>
        <Text style={s.headerBusinessName}>{supplier.business_name}</Text>
        <Text style={s.headerAddress}>{supplier.address}</Text>

        {/* Single meta line — all fields separated by | */}
        <View style={s.headerMetaLine}>
          <Text style={s.headerMetaItem}>GSTIN: {supplier.gstin}</Text>
          <Text style={s.headerMetaDivider}>|</Text>
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

/** Slim centered "TAX INVOICE" document-type stamp — no box, minimal height */
function TaxInvoiceStamp({ taxMode }: { taxMode: 'cgst_sgst' | 'igst' }) {
  return (
    <View style={[s.taxInvoiceStamp, { borderBottomColor: accentColor(taxMode) }]}>
      <Text style={[s.taxInvoiceStampText, { color: accentColor(taxMode) }]}>
        TAX INVOICE
      </Text>
    </View>
  );
}

function TwoColumnMeta({ props }: { props: InvoicePdfProps }) {
  const {
    invoice_number, invoice_date, billing_from, billing_to,
    place_of_supply, place_of_supply_code,
    reverse_charge, work_order_reference, recipient,
  } = props;
  return (
    <View style={s.twoCol}>
      <View style={s.twoColLeft}>
        <Text style={s.colSectionLabel}>INVOICE DETAILS</Text>

        {/* Invoice number — bold, highlighted, first row */}
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
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Place of Supply</Text>
          <Text style={s.metaValue}>{place_of_supply}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>State Code</Text>
          <Text style={s.metaValue}>{place_of_supply_code}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Reverse Charge</Text>
          <Text style={s.metaValue}>{reverse_charge ? 'Yes' : 'No'}</Text>
        </View>
        {work_order_reference ? (
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Work Order Ref</Text>
            <Text style={s.metaValue}>{work_order_reference}</Text>
          </View>
        ) : null}
      </View>

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
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>State</Text>
              <Text style={s.metaValue}>{recipient.state} ({recipient.state_code})</Text>
            </View>
          </View>
        ) : (
          <Text style={s.tableCellMuted}>Unregistered Recipient</Text>
        )}
      </View>
    </View>
  );
}

function SacStrip({ sacCode, taxMode }: { sacCode: string; taxMode: 'cgst_sgst' | 'igst' }) {
  return (
    <View style={[s.sacStrip, { backgroundColor: chipBg(taxMode), borderColor: accentColor(taxMode) }]}>
      <Text style={s.sacLabel}>SAC Code :</Text>
      <Text style={s.sacValue}>{sacCode}</Text>
    </View>
  );
}

function DescriptionBlock({ description }: { description: string }) {
  return (
    <View style={s.descBlock}>
      <Text style={s.descLabel}>DESCRIPTION OF SERVICES</Text>
      <Text style={s.descText}>{description}</Text>
    </View>
  );
}

function QuantityTable({
  lineItems,
  totalTaxable,
}: {
  lineItems: InvoicePdfProps['line_items'];
  totalTaxable: number;
}) {
  return (
    <View style={s.table}>
      <View style={[s.tableHeaderRow, { backgroundColor: QTY_TABLE_HEADER_BG }]}>
        <Text style={[s.tableHeaderCell, s.qColSl]}>Sl.</Text>
        <Text style={[s.tableHeaderCell, s.qColDesc]}>Description of Service</Text>
        <Text style={[s.tableHeaderCell, s.qColUnit]}>Unit</Text>
        <Text style={[s.tableHeaderCell, s.qColQty]}>Qty</Text>
        <Text style={[s.tableHeaderCell, s.qColRate]}>Rate (₹)</Text>
        <Text style={[s.tableHeaderCell, s.qColAmt]}>Amount (₹)</Text>
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
}: {
  rentalItems: InvoicePdfProps['rental_items'];
  totalTaxable: number;
}) {
  return (
    <View style={s.table}>
      <View style={[s.tableHeaderRow, { backgroundColor: RENTAL_TABLE_HEADER_BG }]}>
        <Text style={[s.tableHeaderCell, s.rColSl]}>Sl.</Text>
        <Text style={[s.tableHeaderCell, s.rColVeh]}>Vehicle No</Text>
        <Text style={[s.tableHeaderCell, s.rColType]}>Type</Text>
        <Text style={[s.tableHeaderCell, s.rColPeriod]}>Billing Period</Text>
        <Text style={[s.tableHeaderCell, s.rColMode]}>Billing Mode</Text>
        <Text style={[s.tableHeaderCell, s.rColDays]}>Days</Text>
        <Text style={[s.tableHeaderCell, s.rColRent]}>Monthly Rent (₹)</Text>
        <Text style={[s.tableHeaderCell, s.rColAmt]}>Amount (₹)</Text>
      </View>
      {rentalItems.map((item, idx) => (
        <View key={item.sl_no} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={[s.tableCell, s.rColSl]}>{item.sl_no}</Text>
          <Text style={[s.tableCell, s.rColVeh]}>{item.reg_number}</Text>
          <Text style={[s.tableCell, s.rColType]}>{item.vehicle_type}</Text>
          <Text style={[s.tableCell, s.rColPeriod]}>
            {formatDate(item.billing_from)} – {formatDate(item.billing_to)}
          </Text>
          <Text style={[s.tableCell, s.rColMode]}>{item.billing_mode}</Text>
          <Text style={[s.tableCellRight, s.rColDays]}>{item.num_days}</Text>
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
            {' '}— {item.allocation_pct}%
          </Text>
        </View>
      ))}
    </View>
  );
}

function TotalsSection({ props }: { props: InvoicePdfProps }) {
  const {
    total_taxable, gst_rate, tax_mode,
    total_gst, total_amount, tds_rate, tds_amount, net_receivable,
  } = props;
  const halfRate = gst_rate / 2;
  return (
    <View style={s.totalsSection}>
      <View style={s.totalsRow}>
        <Text style={s.totalsLabel}>Taxable Amount</Text>
        <Text style={s.totalsValue}>₹ {formatCurrency(total_taxable)}</Text>
      </View>
      {tax_mode === 'cgst_sgst' ? (
        <View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>CGST @ {halfRate}%</Text>
            <Text style={s.totalsValue}>₹ {formatCurrency(total_gst / 2)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>SGST @ {halfRate}%</Text>
            <Text style={s.totalsValue}>₹ {formatCurrency(total_gst / 2)}</Text>
          </View>
        </View>
      ) : (
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>IGST @ {gst_rate}%</Text>
          <Text style={s.totalsValue}>₹ {formatCurrency(total_gst)}</Text>
        </View>
      )}
      <View style={[s.totalsRow, { borderTopWidth: 0.75, borderTopColor: DIVIDER }]}>
        <Text style={s.totalsLabelStrong}>Total Amount</Text>
        <Text style={s.totalsValueStrong}>₹ {formatCurrency(total_amount)}</Text>
      </View>
      <View style={s.totalsRow}>
        <Text style={s.totalsLabel}>Less: TDS @ {tds_rate}%</Text>
        <Text style={s.totalsValue}>- ₹ {formatCurrency(tds_amount)}</Text>
      </View>
      <View style={s.netReceivableRow}>
        <Text style={s.netReceivableLabel}>Net Receivable</Text>
        <Text style={s.netReceivableValue}>₹ {formatCurrency(net_receivable)}</Text>
      </View>
    </View>
  );
}

function AmountInWords({ text }: { text: string }) {
  return (
    <View style={s.amountInWords}>
      <Text style={s.amountInWordsLabel}>Amount in Words: </Text>
      <Text style={s.amountInWordsValue}>{text}</Text>
    </View>
  );
}

function FooterSection({
  bank,
  businessName,
  authorizedSignatory,
}: {
  bank: InvoicePdfProps['bank'];
  businessName: string;
  authorizedSignatory: string;
}) {
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
              <Text style={s.footerBankLabel}>IFSC</Text>
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
          <Text style={s.tableCellMuted}>No bank details on file</Text>
        )}
      </View>

      <View style={s.footerRight}>
        <Text style={s.footerSectionLabel}>For {businessName}</Text>
        <View style={{ height: 40 }} />
        <View style={s.footerSignatureLine} />
        <Text style={s.footerSignatoryLabel}>Authorised Signatory</Text>
        {authorizedSignatory ? (
          <Text style={[s.footerSignatoryLabel, { marginTop: 2, fontWeight: 500, color: BODY_TEXT }]}>
            {authorizedSignatory}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function InvoicePdf(props: InvoicePdfProps) {
  const {
    supplier, invoice_number, tax_mode, billing_type,
    sac_code, overall_description,
    line_items, rental_items, item_distribution,
    total_taxable, amount_in_words, bank,
  } = props;

  const isRental     = billing_type === 'rental';
  const hasWorkItems = isRental && item_distribution && item_distribution.length > 0;

  return (
    <Document
      title={`Tax Invoice – ${invoice_number}`}
      author={supplier.business_name}
      subject="GST Tax Invoice"
    >
      <Page size="A4" style={s.page}>
        <HeaderBand supplier={supplier} />
        <TaxInvoiceStamp taxMode={tax_mode} />
        <TwoColumnMeta props={props} />
        {sac_code ? <SacStrip sacCode={sac_code} taxMode={tax_mode} /> : null}
        <DescriptionBlock description={overall_description} />
        {isRental
          ? <RentalTable rentalItems={rental_items} totalTaxable={total_taxable} />
          : <QuantityTable lineItems={line_items} totalTaxable={total_taxable} />
        }
        {hasWorkItems ? <WorkItemsBlock items={item_distribution} /> : null}
        <TotalsSection props={props} />
        <AmountInWords text={amount_in_words} />
        <FooterSection
          bank={bank}
          businessName={supplier.business_name}
          authorizedSignatory={supplier.authorized_signatory}
        />
      </Page>
    </Document>
  );
}
