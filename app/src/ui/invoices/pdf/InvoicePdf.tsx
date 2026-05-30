/**
 * InvoicePdf.tsx
 *
 * @react-pdf/renderer document component for GST-compliant A4 invoice.
 *
 * Supports 4 combinations:
 *   Quantity × CGST/SGST
 *   Quantity × IGST
 *   Rental   × CGST/SGST
 *   Rental   × IGST
 *
 * Layout order (per finalised spec, 2026-05-30):
 *   1. Supplier header band
 *   2. TAX INVOICE heading + prominent invoice number box
 *   3. Two-column: Invoice Details (left) | Recipient details (right)
 *   4. SAC code strip
 *   5. Description of Services block
 *   6. Main billing table (quantity OR rental — never both)
 *   7. Work Items Covered block (rental invoices only, when distribution exists)
 *   8. Tax / totals summary (right-weighted)
 *   9. Amount in words
 *  10. Footer: bank details (left) | authorised signatory (right)
 */

import React from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer'

// ─── Data props ──────────────────────────────────────────────────────────────

export interface PdfSupplier {
  business_name: string
  address: string
  gstin: string
  pan: string | null
  phone: string | null
  email: string | null
  state: string
  state_code: string
  authorized_signatory: string
  logo_url: string | null
}

export interface PdfRecipient {
  name: string
  gstin: string
  address: string
  state: string
  state_code: string
}

export interface PdfLineItem {
  sl_no: number
  description: string
  unit: string | null
  qty: number
  rate: number
  amount: number          // taxable_value
}

export interface PdfRentalItem {
  sl_no: number
  reg_number: string
  vehicle_type: string | null
  billing_from: string    // ISO date
  billing_to: string      // ISO date
  billing_mode: 'full_month' | 'partial_days'
  num_days: number | null
  monthly_rent: number
  amount: number          // subtotal
}

export interface PdfDistributionItem {
  description: string
  sub_work_ref: string | null
  allocation_pct: number
}

export interface PdfBankAccount {
  bank_name: string
  account_name: string
  account_number: string
  ifsc: string
  branch: string | null
}

export interface InvoicePdfProps {
  // Identity
  supplier: PdfSupplier
  recipient: PdfRecipient | null
  invoice_number: string
  invoice_date: string          // ISO
  billing_from: string          // ISO
  billing_to: string            // ISO
  place_of_supply: string
  place_of_supply_code: string
  reverse_charge: boolean
  work_order_reference: string | null

  // Billing type
  billing_type: 'quantity' | 'rental'
  tax_mode: 'cgst_sgst' | 'igst'

  // SAC
  sac_code: string | null

  // Description
  overall_description: string

  // Line items (quantity invoices)
  line_items: PdfLineItem[]

  // Rental items (rental invoices)
  rental_items: PdfRentalItem[]

  // Work items distribution (rental invoices only)
  item_distribution: PdfDistributionItem[]

  // Totals
  total_taxable: number
  gst_rate: number
  total_gst: number
  total_amount: number
  tds_rate: number
  tds_amount: number
  net_receivable: number
  amount_in_words: string

  // Bank
  bank: PdfBankAccount | null
}

// ─── Color constants ──────────────────────────────────────────────────────────

const C = {
  pageBg:          '#FFFFFF',
  headerBg:        '#FAF8F3',
  heading:         '#3B2A1F',
  text:            '#2A1F15',
  muted:           '#7A6A58',
  border:          '#D8D0C4',
  // tax-mode accents
  accentCgst:      '#C8A96A',
  accentIgst:      '#4A7FA5',
  sacBgCgst:       '#FFF8ED',
  sacBgIgst:       '#EEF4FA',
  // table headers
  tableHdrQty:     '#EDE9DE',
  tableHdrRental:  '#E8EEF2',
  tableRowAlt:     '#F7F5F0',
  tableFooterBg:   '#EDE9DE',
  // totals highlight
  highlightBg:     '#3B2A1F',
  highlightText:   '#FAF8F3',
} as const

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d} ${months[parseInt(m) - 1]} ${y}`
}

function fmtPeriod(from: string, to: string): string {
  return `${fmtDate(from)} – ${fmtDate(to)}`
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    backgroundColor: C.pageBg,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 30,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerBand: {
    backgroundColor: C.headerBg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 0,
  },
  headerLogo: {
    width: 52,
    height: 52,
    marginRight: 14,
    objectFit: 'contain',
  },
  headerTextBlock: {
    flex: 1,
  },
  headerBusinessName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: C.heading,
    marginBottom: 3,
    letterSpacing: 0.4,
  },
  headerMeta: {
    fontSize: 8,
    color: C.muted,
    lineHeight: 1.55,
  },
  headerMetaValue: {
    color: C.text,
  },

  // ── TAX INVOICE title band ───────────────────────────────────────────────────
  titleBand: {
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  titleText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: C.heading,
    letterSpacing: 2,
    marginBottom: 5,
  },
  invoiceNumberBox: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 160,
  },
  invoiceNumberLabel: {
    fontSize: 7,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  invoiceNumberValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  // ── Two-column metadata ──────────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  metaCol: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  metaColDivider: {
    borderLeftWidth: 0.5,
    borderLeftColor: C.border,
  },
  metaSectionLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  metaField: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 8,
    color: C.muted,
    width: 90,
  },
  metaValue: {
    fontSize: 8,
    color: C.text,
    flex: 1,
  },
  metaValueBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: C.heading,
    marginBottom: 3,
  },

  // ── SAC strip ───────────────────────────────────────────────────────────────
  sacStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 3,
    marginVertical: 6,
  },
  sacLabel: {
    fontSize: 7.5,
    color: C.muted,
    marginRight: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sacValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 1,
  },

  // ── Description block ───────────────────────────────────────────────────────
  descBlock: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 3,
    marginBottom: 6,
  },
  descLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  descText: {
    fontSize: 8.5,
    color: C.text,
    lineHeight: 1.5,
  },

  // ── Table shared ─────────────────────────────────────────────────────────────
  table: {
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 3,
    marginBottom: 4,
    overflow: 'hidden',
  },
  tableHdrRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.3,
    borderBottomColor: C.border,
    minHeight: 18,
  },
  tableRowLast: {
    flexDirection: 'row',
    minHeight: 18,
  },
  tableFooterRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    backgroundColor: C.tableFooterBg,
    minHeight: 18,
  },
  cellBase: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 8,
  },
  cellHdr: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: C.heading,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  cellNum: {
    textAlign: 'right',
  },
  cellCenter: {
    textAlign: 'center',
  },
  cellFooterLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: C.heading,
    textAlign: 'right',
    paddingHorizontal: 6,
    paddingVertical: 5,
    flex: 1,
  },
  cellFooterValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: C.heading,
    textAlign: 'right',
    paddingHorizontal: 6,
    paddingVertical: 5,
  },

  // ── Work items distribution block ────────────────────────────────────────────
  workItemsBlock: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F7F5F0',
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 3,
    marginBottom: 6,
  },
  workItemsTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  workItemRow: {
    flexDirection: 'row',
    marginBottom: 2.5,
  },
  workItemBullet: {
    fontSize: 8,
    color: C.muted,
    width: 10,
  },
  workItemDesc: {
    fontSize: 8,
    color: C.text,
    flex: 1,
  },
  workItemPct: {
    fontSize: 8,
    color: C.muted,
    width: 36,
    textAlign: 'right',
  },

  // ── Totals ───────────────────────────────────────────────────────────────────
  totalsOuter: {
    marginBottom: 4,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 0.3,
    borderBottomColor: C.border,
  },
  totalsRowPlain: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 8,
    color: C.muted,
    width: 160,
    textAlign: 'right',
    paddingRight: 12,
  },
  totalsValue: {
    fontSize: 8,
    color: C.text,
    width: 80,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  totalsHighlightRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: C.highlightBg,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginTop: 2,
    marginBottom: 2,
  },
  totalsHighlightLabel: {
    fontSize: 9,
    color: C.highlightText,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    textAlign: 'right',
    paddingRight: 12,
  },
  totalsHighlightValue: {
    fontSize: 11,
    color: C.highlightText,
    fontFamily: 'Helvetica-Bold',
    width: 90,
    textAlign: 'right',
  },
  totalsSubRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 2,
  },
  totalsSubLabel: {
    fontSize: 7.5,
    color: C.muted,
    width: 160,
    textAlign: 'right',
    paddingRight: 12,
    fontStyle: 'italic',
  },
  totalsSubValue: {
    fontSize: 7.5,
    color: C.muted,
    width: 80,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  tdsLabel: {
    fontSize: 7.5,
    color: C.muted,
    width: 160,
    textAlign: 'right',
    paddingRight: 12,
  },
  tdsValue: {
    fontSize: 7.5,
    color: C.muted,
    width: 80,
    textAlign: 'right',
  },

  // ── Amount in words ──────────────────────────────────────────────────────────
  amountWordsRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 3,
    marginBottom: 6,
  },
  amountWordsLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: C.muted,
    marginRight: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  amountWordsText: {
    fontSize: 8.5,
    color: C.text,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    lineHeight: 1.4,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 10,
    marginTop: 4,
  },
  footerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  footerRight: {
    width: 170,
    borderLeftWidth: 0.5,
    borderLeftColor: C.border,
    paddingLeft: 14,
  },
  footerSectionLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  footerField: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  footerLabel: {
    fontSize: 7.5,
    color: C.muted,
    width: 88,
  },
  footerValue: {
    fontSize: 7.5,
    color: C.text,
    flex: 1,
  },
  sigForName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: C.heading,
    marginBottom: 30,
  },
  sigLine: {
    borderTopWidth: 0.5,
    borderTopColor: C.muted,
    marginBottom: 4,
    width: 120,
  },
  sigLabel: {
    fontSize: 7.5,
    color: C.muted,
  },

  divider: {
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    marginVertical: 5,
  },
})

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.metaField}>
      <Text style={S.metaLabel}>{label}</Text>
      <Text style={S.metaValue}>{value}</Text>
    </View>
  )
}

function QuantityTable({ items, total_taxable }: { items: PdfLineItem[]; total_taxable: number }) {
  const colWidths = { sl: '6%', desc: '38%', unit: '10%', qty: '12%', rate: '17%', amt: '17%' }
  return (
    <View style={S.table}>
      {/* Header */}
      <View style={[S.tableHdrRow, { backgroundColor: C.tableHdrQty }]}>
        <Text style={[S.cellHdr, { width: colWidths.sl, textAlign: 'center' }]}>Sl.</Text>
        <Text style={[S.cellHdr, { width: colWidths.desc }]}>Description of Service</Text>
        <Text style={[S.cellHdr, { width: colWidths.unit, textAlign: 'center' }]}>Unit</Text>
        <Text style={[S.cellHdr, { width: colWidths.qty, textAlign: 'right' }]}>Quantity</Text>
        <Text style={[S.cellHdr, { width: colWidths.rate, textAlign: 'right' }]}>Rate (₹)</Text>
        <Text style={[S.cellHdr, { width: colWidths.amt, textAlign: 'right' }]}>Amount (₹)</Text>
      </View>
      {/* Rows */}
      {items.map((item, i) => (
        <View
          key={i}
          style={i === items.length - 1 ? S.tableRowLast : S.tableRow}
        >
          <Text style={[S.cellBase, { width: colWidths.sl, textAlign: 'center' }]}>{item.sl_no}</Text>
          <Text style={[S.cellBase, { width: colWidths.desc }]}>{item.description}</Text>
          <Text style={[S.cellBase, { width: colWidths.unit, textAlign: 'center' }]}>{item.unit ?? ''}</Text>
          <Text style={[S.cellBase, S.cellNum, { width: colWidths.qty }]}>{fmt(item.qty)}</Text>
          <Text style={[S.cellBase, S.cellNum, { width: colWidths.rate }]}>{fmt(item.rate)}</Text>
          <Text style={[S.cellBase, S.cellNum, { width: colWidths.amt }]}>{fmt(item.amount)}</Text>
        </View>
      ))}
      {/* Footer */}
      <View style={S.tableFooterRow}>
        <Text style={S.cellFooterLabel}>Taxable Value</Text>
        <Text style={[S.cellFooterValue, { width: colWidths.amt }]}>{fmt(total_taxable)}</Text>
      </View>
    </View>
  )
}

function RentalTable({ items, billing_from, billing_to, total_taxable }: {
  items: PdfRentalItem[]
  billing_from: string
  billing_to: string
  total_taxable: number
}) {
  const col = { sl: '5%', vno: '14%', type: '12%', period: '20%', mode: '14%', days: '7%', rent: '14%', amt: '14%' }
  return (
    <View style={S.table}>
      <View style={[S.tableHdrRow, { backgroundColor: C.tableHdrRental }]}>
        <Text style={[S.cellHdr, { width: col.sl, textAlign: 'center' }]}>Sl.</Text>
        <Text style={[S.cellHdr, { width: col.vno }]}>Vehicle No</Text>
        <Text style={[S.cellHdr, { width: col.type }]}>Type</Text>
        <Text style={[S.cellHdr, { width: col.period }]}>Billing Period</Text>
        <Text style={[S.cellHdr, { width: col.mode, textAlign: 'center' }]}>Mode</Text>
        <Text style={[S.cellHdr, { width: col.days, textAlign: 'center' }]}>Days</Text>
        <Text style={[S.cellHdr, { width: col.rent, textAlign: 'right' }]}>Monthly Rent (₹)</Text>
        <Text style={[S.cellHdr, { width: col.amt, textAlign: 'right' }]}>Amount (₹)</Text>
      </View>
      {items.map((item, i) => {
        const period = item.billing_mode === 'full_month'
          ? fmtPeriod(billing_from, billing_to)
          : fmtPeriod(item.billing_from, item.billing_to)
        const modeLabel = item.billing_mode === 'full_month' ? 'Full Month' : 'Partial'
        const daysStr   = item.billing_mode === 'partial_days' && item.num_days ? String(item.num_days) : '—'
        return (
          <View key={i} style={i === items.length - 1 ? S.tableRowLast : S.tableRow}>
            <Text style={[S.cellBase, { width: col.sl, textAlign: 'center' }]}>{item.sl_no}</Text>
            <Text style={[S.cellBase, { width: col.vno }]}>{item.reg_number}</Text>
            <Text style={[S.cellBase, { width: col.type }]}>{item.vehicle_type ?? ''}</Text>
            <Text style={[S.cellBase, { width: col.period, fontSize: 7.5 }]}>{period}</Text>
            <Text style={[S.cellBase, { width: col.mode, textAlign: 'center' }]}>{modeLabel}</Text>
            <Text style={[S.cellBase, { width: col.days, textAlign: 'center' }]}>{daysStr}</Text>
            <Text style={[S.cellBase, S.cellNum, { width: col.rent }]}>{fmt(item.monthly_rent)}</Text>
            <Text style={[S.cellBase, S.cellNum, { width: col.amt }]}>{fmt(item.amount)}</Text>
          </View>
        )
      })}
      <View style={S.tableFooterRow}>
        <Text style={S.cellFooterLabel}>Taxable Value</Text>
        <Text style={[S.cellFooterValue, { width: col.amt }]}>{fmt(total_taxable)}</Text>
      </View>
    </View>
  )
}

function WorkItemsBlock({ items }: { items: PdfDistributionItem[] }) {
  if (items.length === 0) return null
  return (
    <View style={S.workItemsBlock}>
      <Text style={S.workItemsTitle}>Work Items Covered Under This Billing Period</Text>
      {items.map((d, i) => (
        <View key={i} style={S.workItemRow}>
          <Text style={S.workItemBullet}>–</Text>
          <Text style={S.workItemDesc}>
            {d.description}
            {d.sub_work_ref ? ` (Sub-ref: ${d.sub_work_ref})` : ''}
          </Text>
          <Text style={S.workItemPct}>{d.allocation_pct.toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  )
}

function TotalsBlock({
  tax_mode, gst_rate, total_taxable, total_gst, total_amount,
  tds_rate, tds_amount, net_receivable,
}: Pick<InvoicePdfProps,
  'tax_mode' | 'gst_rate' | 'total_taxable' | 'total_gst' | 'total_amount' |
  'tds_rate' | 'tds_amount' | 'net_receivable'
>) {
  const halfGst   = total_gst / 2
  const halfRate  = gst_rate / 2
  return (
    <View style={S.totalsOuter}>
      {/* Taxable */}
      <View style={S.totalsRow}>
        <Text style={S.totalsLabel}>Taxable Amount</Text>
        <Text style={S.totalsValue}>₹ {fmt(total_taxable)}</Text>
      </View>
      {/* GST */}
      {tax_mode === 'cgst_sgst' ? (
        <>
          <View style={S.totalsRow}>
            <Text style={S.totalsLabel}>CGST @ {halfRate}%</Text>
            <Text style={S.totalsValue}>₹ {fmt(halfGst)}</Text>
          </View>
          <View style={S.totalsRow}>
            <Text style={S.totalsLabel}>SGST @ {halfRate}%</Text>
            <Text style={S.totalsValue}>₹ {fmt(halfGst)}</Text>
          </View>
        </>
      ) : (
        <View style={S.totalsRow}>
          <Text style={S.totalsLabel}>IGST @ {gst_rate}%</Text>
          <Text style={S.totalsValue}>₹ {fmt(total_gst)}</Text>
        </View>
      )}
      {/* Total */}
      <View style={S.totalsRow}>
        <Text style={S.totalsLabel}>Total Amount</Text>
        <Text style={S.totalsValue}>₹ {fmt(total_amount)}</Text>
      </View>
      {/* TDS informational line */}
      {tds_rate > 0 && (
        <View style={S.totalsSubRow}>
          <Text style={S.tdsLabel}>Less: TDS @ {tds_rate}% (deducted by client)</Text>
          <Text style={S.tdsValue}>₹ {fmt(tds_amount)}</Text>
        </View>
      )}
      {/* Net Receivable — highlighted */}
      <View style={S.totalsHighlightRow}>
        <Text style={S.totalsHighlightLabel}>Net Receivable</Text>
        <Text style={S.totalsHighlightValue}>₹ {fmt(net_receivable)}</Text>
      </View>
    </View>
  )
}

// ─── Main document component ──────────────────────────────────────────────────

export function InvoicePdf(props: InvoicePdfProps) {
  const {
    supplier, recipient,
    invoice_number, invoice_date, billing_from, billing_to,
    place_of_supply, place_of_supply_code, reverse_charge, work_order_reference,
    billing_type, tax_mode,
    sac_code, overall_description,
    line_items, rental_items, item_distribution,
    total_taxable, gst_rate, total_gst, total_amount,
    tds_rate, tds_amount, net_receivable, amount_in_words,
    bank,
  } = props

  const accent    = tax_mode === 'igst' ? C.accentIgst   : C.accentCgst
  const sacBg     = tax_mode === 'igst' ? C.sacBgIgst    : C.sacBgCgst

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ─── 1. Supplier Header ─── */}
        <View style={S.headerBand} fixed>
          {supplier.logo_url && (
            <Image style={S.headerLogo} src={supplier.logo_url} />
          )}
          <View style={S.headerTextBlock}>
            <Text style={S.headerBusinessName}>{supplier.business_name}</Text>
            <Text style={S.headerMeta}>{supplier.address}</Text>
            <Text style={S.headerMeta}>
              <Text style={S.headerMeta}>GSTIN: </Text>
              <Text style={[S.headerMeta, S.headerMetaValue]}>{supplier.gstin}</Text>
              {supplier.pan ? (
                <Text style={S.headerMeta}>{'  |  PAN: '}<Text style={[S.headerMeta, S.headerMetaValue]}>{supplier.pan}</Text></Text>
              ) : null}
            </Text>
            {(supplier.phone || supplier.email) && (
              <Text style={S.headerMeta}>
                {[supplier.phone, supplier.email].filter(Boolean).join('  |  ')}
              </Text>
            )}
            <Text style={S.headerMeta}>
              State: <Text style={[S.headerMeta, S.headerMetaValue]}>{supplier.state} ({supplier.state_code})</Text>
            </Text>
          </View>
        </View>

        {/* ─── 2. TAX INVOICE title + Invoice Number ─── */}
        <View style={S.titleBand}>
          <Text style={S.titleText}>TAX INVOICE</Text>
          <View style={[S.invoiceNumberBox, { borderColor: accent }]}>
            <Text style={S.invoiceNumberLabel}>Invoice No.</Text>
            <Text style={[S.invoiceNumberValue, { color: accent }]}>{invoice_number || 'PENDING'}</Text>
          </View>
        </View>

        {/* ─── 3. Two-column metadata: Invoice Details | Recipient ─── */}
        <View style={S.metaRow}>
          {/* Left: Invoice Details */}
          <View style={S.metaCol}>
            <Text style={S.metaSectionLabel}>Invoice Details</Text>
            <MetaField label="Invoice Date"      value={fmtDate(invoice_date)} />
            <MetaField label="Billing Period"    value={fmtPeriod(billing_from, billing_to)} />
            <MetaField label="Place of Supply"   value={`${place_of_supply} (${place_of_supply_code})`} />
            <MetaField label="Reverse Charge"    value={reverse_charge ? 'Yes' : 'No'} />
            {work_order_reference && (
              <MetaField label="W.O. Reference" value={work_order_reference} />
            )}
          </View>

          {/* Right: Recipient */}
          <View style={[S.metaCol, S.metaColDivider]}>
            <Text style={S.metaSectionLabel}>Details of Recipient of Service</Text>
            {recipient ? (
              <>
                <Text style={S.metaValueBold}>{recipient.name}</Text>
                {recipient.gstin ? <MetaField label="GSTIN" value={recipient.gstin} /> : null}
                <View style={S.metaField}>
                  <Text style={S.metaLabel}>Address</Text>
                  <Text style={[S.metaValue, { lineHeight: 1.5 }]}>{recipient.address}</Text>
                </View>
                <MetaField label="State" value={`${recipient.state} (${recipient.state_code})`} />
              </>
            ) : (
              <Text style={{ fontSize: 8, color: C.muted }}>Recipient details not available</Text>
            )}
          </View>
        </View>

        {/* ─── 4. SAC Code strip ─── */}
        {sac_code && (
          <View style={[S.sacStrip, { backgroundColor: sacBg, borderColor: accent }]}>
            <Text style={[S.sacLabel, { color: accent }]}>SAC Code</Text>
            <Text style={[S.sacValue, { color: C.heading }]}>{sac_code}</Text>
          </View>
        )}

        {/* ─── 5. Description of Services ─── */}
        {overall_description ? (
          <View style={S.descBlock}>
            <Text style={S.descLabel}>Description of Services</Text>
            <Text style={S.descText}>{overall_description}</Text>
          </View>
        ) : null}

        {/* ─── 6. Main billing table ─── */}
        {billing_type === 'quantity' ? (
          <QuantityTable items={line_items} total_taxable={total_taxable} />
        ) : (
          <RentalTable
            items={rental_items}
            billing_from={billing_from}
            billing_to={billing_to}
            total_taxable={total_taxable}
          />
        )}

        {/* ─── 7. Work Items Covered (rental only) ─── */}
        {billing_type === 'rental' && (
          <WorkItemsBlock items={item_distribution} />
        )}

        {/* ─── 8. Totals ─── */}
        <TotalsBlock
          tax_mode={tax_mode}
          gst_rate={gst_rate}
          total_taxable={total_taxable}
          total_gst={total_gst}
          total_amount={total_amount}
          tds_rate={tds_rate}
          tds_amount={tds_amount}
          net_receivable={net_receivable}
        />

        {/* ─── 9. Amount in words ─── */}
        {amount_in_words && (
          <View style={S.amountWordsRow}>
            <Text style={S.amountWordsLabel}>Amount in Words:</Text>
            <Text style={S.amountWordsText}>{amount_in_words}</Text>
          </View>
        )}

        {/* ─── 10. Footer: Bank Details | Authorised Signatory ─── */}
        <View style={S.footer}>
          {/* Left: Bank Details */}
          <View style={S.footerLeft}>
            <Text style={S.footerSectionLabel}>Bank Details</Text>
            {bank ? (
              <>
                <View style={S.footerField}>
                  <Text style={S.footerLabel}>Bank Name</Text>
                  <Text style={S.footerValue}>{bank.bank_name}</Text>
                </View>
                <View style={S.footerField}>
                  <Text style={S.footerLabel}>Account Name</Text>
                  <Text style={S.footerValue}>{bank.account_name}</Text>
                </View>
                <View style={S.footerField}>
                  <Text style={S.footerLabel}>Account Number</Text>
                  <Text style={S.footerValue}>{bank.account_number}</Text>
                </View>
                <View style={S.footerField}>
                  <Text style={S.footerLabel}>IFSC</Text>
                  <Text style={S.footerValue}>{bank.ifsc}</Text>
                </View>
                {bank.branch && (
                  <View style={S.footerField}>
                    <Text style={S.footerLabel}>Branch</Text>
                    <Text style={S.footerValue}>{bank.branch}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 8, color: C.muted }}>No bank account selected</Text>
            )}
          </View>

          {/* Right: Authorised Signatory */}
          <View style={S.footerRight}>
            <Text style={S.footerSectionLabel}>For {supplier.business_name}</Text>
            <Text style={S.sigForName}> </Text>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>{supplier.authorized_signatory}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Authorised Signatory</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
