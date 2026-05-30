/**
 * QuantityLineItemsTable.tsx
 * Renders the line items table for quantity-based invoices.
 * Columns: Sl. No | Description | Unit | Qty | Rate | Taxable Value
 */
import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { QuantityLineItemPayload } from './invoicePayloadTypes';
import { formatCurrency } from './pdfUtils';
import { BODY_TEXT, MUTED, ESPRESSO, DIVIDER } from './InvoiceDocument';

const CREAM = '#FAF8F3';
const WHITE = '#FFFFFF';

const s = StyleSheet.create({
  table: { width: '100%', marginBottom: 2 },
  header: {
    flexDirection: 'row',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
  },
  rowAlt: { backgroundColor: CREAM },
  // Column widths
  colSl: { width: 24, fontSize: 7, color: MUTED },
  colDesc: { flex: 1, fontSize: 7.5 },
  colUnit: { width: 36, fontSize: 7, textAlign: 'center' },
  colQty: { width: 36, fontSize: 7.5, textAlign: 'right' },
  colRate: { width: 52, fontSize: 7.5, textAlign: 'right' },
  colAmt: { width: 64, fontSize: 7.5, textAlign: 'right' },
  // Header text
  hText: { fontSize: 6.5, fontWeight: 700, color: ESPRESSO, textTransform: 'uppercase' },
  totalRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: CREAM,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
    marginTop: 1,
  },
  totalLabel: { flex: 1, fontSize: 7.5, fontWeight: 700, color: ESPRESSO, textAlign: 'right', paddingRight: 6 },
  totalValue: { width: 64, fontSize: 7.5, fontWeight: 700, color: ESPRESSO, textAlign: 'right' },
});

export function QuantityLineItemsTable({
  items,
  tableHeaderBg,
}: {
  items: QuantityLineItemPayload[];
  tableHeaderBg: string;
}) {
  const total = items.reduce((sum, it) => sum + it.taxable_value, 0);

  return (
    <View style={s.table}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: tableHeaderBg }]}>
        <Text style={[s.colSl, s.hText]}>#</Text>
        <Text style={[s.colDesc, s.hText]}>Description of Service</Text>
        <Text style={[s.colUnit, s.hText]}>Unit</Text>
        <Text style={[s.colQty, s.hText]}>Qty</Text>
        <Text style={[s.colRate, s.hText]}>Rate (₹)</Text>
        <Text style={[s.colAmt, s.hText]}>Amount (₹)</Text>
      </View>

      {/* Rows */}
      {items.map((item, i) => (
        <View key={i} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]}>
          <Text style={s.colSl}>{item.sl_no}</Text>
          <Text style={[s.colDesc, { color: BODY_TEXT }]}>{item.description}</Text>
          <Text style={[s.colUnit, { color: MUTED }]}>{item.unit ?? ''}</Text>
          <Text style={[s.colQty, { color: BODY_TEXT }]}>{item.qty}</Text>
          <Text style={[s.colRate, { color: BODY_TEXT }]}>{formatCurrency(item.rate)}</Text>
          <Text style={[s.colAmt, { color: BODY_TEXT }]}>{formatCurrency(item.taxable_value)}</Text>
        </View>
      ))}

      {/* Total row */}
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Taxable Value</Text>
        <Text style={s.totalValue}>{formatCurrency(total)}</Text>
      </View>
    </View>
  );
}
