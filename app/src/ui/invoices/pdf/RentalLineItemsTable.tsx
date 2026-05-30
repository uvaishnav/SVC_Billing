/**
 * RentalLineItemsTable.tsx
 * Renders the vehicle rental items table + Work Items Covered block.
 * Columns: Sl. No | Vehicle (Reg No) | Billing Mode | Days | Monthly Rent | Subtotal
 */
import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { RentalLineItemPayload, DistributionItemPayload } from './invoicePayloadTypes';
import { formatCurrency, BODY_TEXT, MUTED, ESPRESSO, DIVIDER, FAINT } from './pdfUtils';

const CREAM = '#FAF8F3';

const s = StyleSheet.create({
  table: { width: '100%', marginBottom: 6 },
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
  colSl: { width: 24, fontSize: 7 },
  colVehicle: { flex: 1, fontSize: 7.5 },
  colMode: { width: 70, fontSize: 7, textAlign: 'center' },
  colDays: { width: 32, fontSize: 7.5, textAlign: 'center' },
  colRent: { width: 64, fontSize: 7.5, textAlign: 'right' },
  colSubtotal: { width: 64, fontSize: 7.5, textAlign: 'right' },

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

  // Work items covered block
  workItemsBlock: {
    marginTop: 6,
    padding: 10,
    backgroundColor: CREAM,
    borderRadius: 3,
    marginBottom: 2,
  },
  workItemsTitle: {
    fontSize: 6.5,
    fontWeight: 700,
    color: FAINT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
    paddingBottom: 3,
  },
  workItemRow: { flexDirection: 'row', marginBottom: 2.5, alignItems: 'flex-start' },
  workItemBullet: { fontSize: 7, color: MUTED, width: 10 },
  workItemDesc: { flex: 1, fontSize: 7.5, color: BODY_TEXT, lineHeight: 1.4 },
  workItemPct: { width: 36, fontSize: 7, color: MUTED, textAlign: 'right' },
  workItemAmt: { width: 64, fontSize: 7.5, color: BODY_TEXT, textAlign: 'right' },
  workItemsInfoNote: {
    fontSize: 6.5,
    color: FAINT,
    fontStyle: 'italic',
    marginTop: 5,
  },
});

export function RentalLineItemsTable({
  items,
  distributionItems,
  tableHeaderBg,
}: {
  items: RentalLineItemPayload[];
  distributionItems: DistributionItemPayload[];
  tableHeaderBg: string;
}) {
  const total = items.reduce((sum, it) => sum + it.subtotal, 0);

  return (
    <>
      <View style={s.table}>
        {/* Header */}
        <View style={[s.header, { backgroundColor: tableHeaderBg }]}>
          <Text style={[s.colSl, s.hText]}>#</Text>
          <Text style={[s.colVehicle, s.hText]}>Vehicle / Description</Text>
          <Text style={[s.colMode, s.hText]}>Billing Mode</Text>
          <Text style={[s.colDays, s.hText]}>Days</Text>
          <Text style={[s.colRent, s.hText]}>Monthly Rent</Text>
          <Text style={[s.colSubtotal, s.hText]}>Subtotal (₹)</Text>
        </View>

        {/* Rows */}
        {items.map((item, i) => (
          <View key={i} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]}>
            <Text style={[s.colSl, { color: MUTED }]}>{i + 1}</Text>
            <View style={s.colVehicle}>
              <Text style={{ fontSize: 7.5, color: BODY_TEXT, fontWeight: 600 }}>{item.reg_number}</Text>
              {item.vehicle_type ? <Text style={{ fontSize: 7, color: MUTED }}>{item.vehicle_type}</Text> : null}
            </View>
            <Text style={[s.colMode, { color: MUTED }]}>
              {item.billing_mode === 'full_month' ? 'Full Month' : 'Partial Days'}
            </Text>
            <Text style={[s.colDays, { color: BODY_TEXT }]}>
              {item.billing_mode === 'full_month' ? '–' : String(item.num_days ?? '')}
            </Text>
            <Text style={[s.colRent, { color: BODY_TEXT }]}>{formatCurrency(item.monthly_rent)}</Text>
            <Text style={[s.colSubtotal, { color: BODY_TEXT, fontWeight: 600 }]}>{formatCurrency(item.subtotal)}</Text>
          </View>
        ))}

        {/* Total row */}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Taxable Value</Text>
          <Text style={s.totalValue}>{formatCurrency(total)}</Text>
        </View>
      </View>

      {/* Work Items Covered block */}
      {distributionItems.length > 0 && (
        <View style={s.workItemsBlock}>
          <Text style={s.workItemsTitle}>Work Items Covered Under This Billing Period</Text>
          {distributionItems.map((d, i) => (
            <View key={i} style={s.workItemRow}>
              <Text style={s.workItemBullet}>·</Text>
              <Text style={s.workItemDesc}>{d.description}</Text>
              <Text style={s.workItemPct}>{d.allocation_pct.toFixed(0)}%</Text>
              <Text style={s.workItemAmt}>{formatCurrency(d.allocated_amount)}</Text>
            </View>
          ))}
          <Text style={s.workItemsInfoNote}>
            (Informational only — for internal project cost allocation. Not a GST-mandatory field.)
          </Text>
        </View>
      )}
    </>
  );
}
