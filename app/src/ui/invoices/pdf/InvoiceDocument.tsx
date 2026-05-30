/**
 * InvoiceDocument.tsx
 * react-pdf/renderer root document — routes to quantity or rental layout.
 * Branded with Playfair Display + Work Sans; dual-axis color system.
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
import type { InvoicePayload } from './invoicePayloadTypes';
import { QuantityLineItemsTable } from './QuantityLineItemsTable';
import { RentalLineItemsTable } from './RentalLineItemsTable';
import {
  formatCurrency,
  toWords,
  formatDate,
  ESPRESSO,
  BODY_TEXT,
  MUTED,
  FAINT,
  CREAM,
  DIVIDER,
  WHITE,
  GOLD_ACCENT,
  GOLD_CHIP_BG,
  STEEL_ACCENT,
  STEEL_CHIP_BG,
  QTY_TABLE_HEADER_BG,
  RENTAL_TABLE_HEADER_BG,
} from './pdfUtils';

// ── Font registration ───────────────────────────────────────────────────────────────
Font.register({
  family: 'PlayfairDisplay',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vUDQ.woff2',
      fontWeight: 700,
    },
  ],
});
Font.register({
  family: 'WorkSans',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43Rh_c6Dpp_k.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43Rh_faDpp_k.woff2',
      fontWeight: 600,
    },
    {
      src: 'https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43Rh_eaDpp_k.woff2',
      fontWeight: 700,
    },
  ],
});

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: 'WorkSans',
    fontSize: 8,
    color: BODY_TEXT,
    backgroundColor: WHITE,
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 48,
  },

  // Header band
  headerBand: {
    backgroundColor: CREAM,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  logoBox: { width: 52, height: 52, marginRight: 14 },
  logo: { width: 52, height: 52, objectFit: 'contain' },
  supplierBlock: { flex: 1 },
  supplierName: {
    fontFamily: 'PlayfairDisplay',
    fontWeight: 700,
    fontSize: 15,
    color: ESPRESSO,
    marginBottom: 3,
  },
  supplierMeta: { fontSize: 7.5, color: MUTED, marginBottom: 1.5 },
  supplierFaint: { fontSize: 7, color: FAINT, marginTop: 1 },

  // Document identity band
  identityBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  taxInvoiceLabel: {
    fontFamily: 'PlayfairDisplay',
    fontWeight: 700,
    fontSize: 13,
    color: ESPRESSO,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  invoiceNumberBox: {
    border: '1.5pt solid',
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'flex-end',
  },
  invoiceNumberLabel: { fontSize: 6.5, color: MUTED, marginBottom: 2 },
  invoiceNumberValue: {
    fontFamily: 'PlayfairDisplay',
    fontWeight: 700,
    fontSize: 11,
  },

  // Two-column details row
  detailsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  detailsColumn: {
    flex: 1,
    backgroundColor: CREAM,
    borderRadius: 3,
    padding: 10,
  },
  detailsColTitle: {
    fontSize: 6.5,
    fontWeight: 700,
    color: FAINT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
    paddingBottom: 3,
  },
  detailRow: { flexDirection: 'row', marginBottom: 2.5 },
  detailLabel: { width: 90, fontSize: 7, color: MUTED },
  detailValue: { flex: 1, fontSize: 7.5, fontWeight: 600, color: BODY_TEXT },
  detailValueMuted: { flex: 1, fontSize: 7, color: MUTED },

  // SAC chip
  sacChipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sacChipLabel: { fontSize: 7, color: MUTED, marginRight: 6 },
  sacChip: {
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 8,
    fontWeight: 700,
  },

  // Description block
  descBlock: {
    backgroundColor: CREAM,
    borderRadius: 3,
    padding: 10,
    marginBottom: 10,
  },
  descTitle: {
    fontSize: 6.5,
    fontWeight: 700,
    color: FAINT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  descText: { fontSize: 8, color: BODY_TEXT, lineHeight: 1.55 },

  // Totals block
  totalsBlock: { marginTop: 8, alignItems: 'flex-end' },
  totalsInner: { width: 240 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  totalsLabel: { fontSize: 7.5, color: MUTED },
  totalsValue: { fontSize: 7.5, color: BODY_TEXT },
  totalsHighlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: ESPRESSO,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
    marginBottom: 2,
  },
  totalsHighlightLabel: { fontSize: 8.5, fontWeight: 700, color: CREAM },
  totalsHighlightValue: { fontSize: 8.5, fontWeight: 700, color: CREAM },
  tdsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  tdsLabel: { fontSize: 7, color: FAINT, fontStyle: 'italic' },
  tdsValue: { fontSize: 7, color: FAINT },
  netReceivableRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  netLabel: { fontSize: 8, fontWeight: 600, color: ESPRESSO },
  netValue: { fontSize: 8, fontWeight: 600, color: ESPRESSO },

  // Amount in words
  amountWords: {
    marginTop: 10,
    padding: 8,
    backgroundColor: CREAM,
    borderRadius: 3,
  },
  amountWordsLabel: { fontSize: 6.5, color: FAINT, marginBottom: 2 },
  amountWordsText: { fontSize: 8, fontWeight: 600, color: ESPRESSO, lineHeight: 1.4 },

  // Bank details
  bankBlock: { marginTop: 10, flexDirection: 'row', gap: 10 },
  bankColumn: {
    flex: 1,
    backgroundColor: CREAM,
    borderRadius: 3,
    padding: 10,
  },
  bankTitle: {
    fontSize: 6.5,
    fontWeight: 700,
    color: FAINT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
    paddingBottom: 3,
  },
  bankRow: { flexDirection: 'row', marginBottom: 2.5 },
  bankLabel: { width: 80, fontSize: 7, color: MUTED },
  bankValue: { flex: 1, fontSize: 7.5, fontWeight: 600, color: BODY_TEXT },

  // Declaration + signature
  signatureBlock: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  declarationBlock: { flex: 1, paddingRight: 20 },
  declarationTitle: { fontSize: 6.5, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  declarationText: { fontSize: 7, color: MUTED, lineHeight: 1.5 },
  sigBlock: { alignItems: 'flex-end' },
  sigLine: { width: 120, borderBottomWidth: 0.5, borderBottomColor: DIVIDER, marginBottom: 4 },
  sigName: { fontSize: 7.5, fontWeight: 600, color: ESPRESSO },
  sigTitle: { fontSize: 7, color: MUTED },

  // Footer page number
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 7,
    color: FAINT,
  },

  divider: { borderBottomWidth: 0.5, borderBottomColor: DIVIDER, marginVertical: 6 },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function taxModeColors(taxMode: string) {
  return taxMode === 'igst'
    ? { accent: STEEL_ACCENT, chipBg: STEEL_CHIP_BG }
    : { accent: GOLD_ACCENT, chipBg: GOLD_CHIP_BG };
}

// ── Main component ────────────────────────────────────────────────────────────────
export function InvoiceDocument({ payload }: { payload: InvoicePayload }) {
  const { inv, supplier, client, bank, lineItems, rentalItems, distributionItems } = payload;
  const { accent, chipBg } = taxModeColors(inv.tax_mode);
  const tableHeaderBg = inv.line_item_billing_type === 'rental' ? RENTAL_TABLE_HEADER_BG : QTY_TABLE_HEADER_BG;

  return (
    <Document title={`Invoice ${inv.invoice_number}`} author={supplier.business_name}>
      <Page size="A4" style={s.page}>

        {/* ── 1. Header band ── */}
        <View style={s.headerBand}>
          {supplier.logo_url && (
            <View style={s.logoBox}>
              <Image src={supplier.logo_url} style={s.logo} />
            </View>
          )}
          <View style={s.supplierBlock}>
            <Text style={s.supplierName}>{supplier.business_name}</Text>
            <Text style={s.supplierMeta}>{supplier.address}</Text>
            <Text style={s.supplierMeta}>
              GSTIN: {supplier.gstin}
              {supplier.pan ? `   |   PAN: ${supplier.pan}` : ''}
            </Text>
            <Text style={s.supplierMeta}>
              State: {supplier.state}  ({supplier.state_code})
            </Text>
            {(supplier.phone || supplier.email) && (
              <Text style={s.supplierFaint}>
                {[supplier.phone, supplier.email].filter(Boolean).join('   |   ')}
              </Text>
            )}
          </View>
        </View>

        {/* ── 2. Document identity band ── */}
        <View style={s.identityBand}>
          <Text style={s.taxInvoiceLabel}>Tax Invoice</Text>
          <View style={[s.invoiceNumberBox, { borderColor: accent }]}>
            <Text style={s.invoiceNumberLabel}>INVOICE NUMBER</Text>
            <Text style={[s.invoiceNumberValue, { color: accent }]}>{inv.invoice_number}</Text>
          </View>
        </View>

        {/* ── 3. Two-column: Invoice Details + Bill To ── */}
        <View style={s.detailsRow}>
          {/* Invoice Details */}
          <View style={s.detailsColumn}>
            <Text style={s.detailsColTitle}>Invoice Details</Text>
            <DetailRow label="Invoice Date" value={formatDate(inv.invoice_date)} />
            <DetailRow label="Billing Period" value={`${formatDate(inv.billing_from)} – ${formatDate(inv.billing_to)}`} />
            <DetailRow label="Tax Mode" value={inv.tax_mode === 'igst' ? 'IGST (Inter-state)' : 'CGST + SGST (Intra-state)'} />
            <DetailRow label="Reverse Charge" value={inv.reverse_charge ? 'Yes' : 'No'} />
            {inv.wo_reference && <DetailRow label="W.O. Ref" value={inv.wo_reference} muted />}
          </View>

          {/* Bill To */}
          <View style={s.detailsColumn}>
            <Text style={s.detailsColTitle}>Bill To</Text>
            <Text style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 9, color: ESPRESSO, marginBottom: 4 }}>
              {client.name}
            </Text>
            <Text style={{ fontSize: 7.5, color: MUTED, marginBottom: 3, lineHeight: 1.5 }}>{client.address}</Text>
            <DetailRow label="GSTIN" value={client.gstin} />
            <DetailRow label="Place of Supply" value={`${client.state} (${client.state_code})`} />
          </View>
        </View>

        {/* ── 4. SAC chip ── */}
        <View style={s.sacChipRow}>
          <Text style={s.sacChipLabel}>HSN / SAC Code:</Text>
          <View style={[s.sacChip, { backgroundColor: chipBg }]}>
            <Text style={{ color: accent, fontWeight: 700 }}>{inv.sac_code}</Text>
          </View>
        </View>

        {/* ── 5. Description ── */}
        {inv.description && (
          <View style={s.descBlock}>
            <Text style={s.descTitle}>Description of Services</Text>
            <Text style={s.descText}>{inv.description}</Text>
          </View>
        )}

        {/* ── 6. Line items table ── */}
        {inv.line_item_billing_type === 'rental' ? (
          <RentalLineItemsTable
            items={rentalItems ?? []}
            distributionItems={distributionItems ?? []}
            tableHeaderBg={tableHeaderBg}
          />
        ) : (
          <QuantityLineItemsTable items={lineItems ?? []} tableHeaderBg={tableHeaderBg} />
        )}

        {/* ── 7. Totals ── */}
        <View style={s.totalsBlock}>
          <View style={s.totalsInner}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Taxable Value</Text>
              <Text style={s.totalsValue}>{formatCurrency(inv.total_taxable)}</Text>
            </View>
            {inv.tax_mode === 'cgst_sgst' ? (
              <>
                <View style={s.totalsRow}>
                  <Text style={s.totalsLabel}>CGST @ 9%</Text>
                  <Text style={s.totalsValue}>{formatCurrency(inv.cgst_amount ?? 0)}</Text>
                </View>
                <View style={s.totalsRow}>
                  <Text style={s.totalsLabel}>SGST @ 9%</Text>
                  <Text style={s.totalsValue}>{formatCurrency(inv.sgst_amount ?? 0)}</Text>
                </View>
              </>
            ) : (
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>IGST @ 18%</Text>
                <Text style={s.totalsValue}>{formatCurrency(inv.igst_amount ?? 0)}</Text>
              </View>
            )}
            <View style={s.totalsHighlightRow}>
              <Text style={s.totalsHighlightLabel}>Total Invoice Amount</Text>
              <Text style={s.totalsHighlightValue}>{formatCurrency(inv.total_invoice_amount)}</Text>
            </View>
            {inv.tds_amount != null && inv.tds_amount > 0 && (
              <>
                <View style={s.tdsRow}>
                  <Text style={s.tdsLabel}>TDS @ 2% (deducted by client)</Text>
                  <Text style={s.tdsValue}>– {formatCurrency(inv.tds_amount)}</Text>
                </View>
                <View style={s.netReceivableRow}>
                  <Text style={s.netLabel}>Net Receivable</Text>
                  <Text style={s.netValue}>{formatCurrency(inv.net_receivable ?? 0)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── 8. Amount in words ── */}
        <View style={s.amountWords}>
          <Text style={s.amountWordsLabel}>Amount in Words (Total Invoice Amount)</Text>
          <Text style={s.amountWordsText}>{toWords(inv.total_invoice_amount)}</Text>
        </View>

        {/* ── 9. Bank details ── */}
        <View style={s.bankBlock}>
          <View style={s.bankColumn}>
            <Text style={s.bankTitle}>Bank Details</Text>
            <BankRow label="Bank" value={bank.bank_name} />
            <BankRow label="Account Name" value={bank.account_name} />
            <BankRow label="Account No." value={bank.account_number} />
            <BankRow label="IFSC" value={bank.ifsc} />
            {bank.branch && <BankRow label="Branch" value={bank.branch} />}
          </View>
        </View>

        {/* ── 10. Declaration + Signature ── */}
        <View style={s.signatureBlock}>
          <View style={s.declarationBlock}>
            <Text style={s.declarationTitle}>Declaration</Text>
            <Text style={s.declarationText}>
              We declare that this invoice shows the actual price of the goods / services described and that all particulars are true and correct. All disputes are subject to local jurisdiction only.
            </Text>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine} />
            <Text style={s.sigName}>{supplier.authorized_signatory}</Text>
            <Text style={s.sigTitle}>Authorised Signatory</Text>
            <Text style={s.sigTitle}>{supplier.business_name}</Text>
          </View>
        </View>

        {/* Page number */}
        <Text
          style={s.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────────────
function DetailRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  const valueStyle = muted ? s.detailValueMuted : s.detailValue;
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

function BankRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.bankRow}>
      <Text style={s.bankLabel}>{label}</Text>
      <Text style={s.bankValue}>{value}</Text>
    </View>
  );
}
