import { supabase } from './supabaseClient'
import type {
  Invoice, InvoiceLineItem, InvoiceVehicle,
  InvoiceWithDetails, InvoiceDraft, InvoiceStatus
} from './types'

// ─── Helpers ─────────────────────────────────────────────────

/** Convert an InvoiceDraft to the invoices row shape for upsert */
function draftToRow(draft: InvoiceDraft): Omit<Invoice, 'id' | 'created_at' | 'updated_at'> {
  return {
    invoice_number:       draft.invoice_number,
    invoice_date:         draft.invoice_date,
    billing_from:         draft.billing_from,
    billing_to:           draft.billing_to,
    client_id:            draft.client_id,
    client_gstin_id:      draft.client_gstin_id,
    work_order_id:        draft.work_order_id,
    tax_mode:             draft.tax_mode,
    place_of_supply:      draft.place_of_supply,
    place_of_supply_code: draft.place_of_supply_code,
    reverse_charge:       draft.reverse_charge,
    total_taxable:        draft.total_taxable,
    gst_rate:             draft.gst_rate,
    total_gst:            draft.total_gst,
    total_amount:         draft.total_amount,
    tds_rate:             draft.tds_rate,
    tds_amount:           draft.tds_amount,
    net_receivable:       draft.net_receivable,
    amount_in_words:      draft.amount_in_words,
    overall_description:  draft.overall_description,
    bank_account_id:      draft.bank_account_id,
    sac_id:               draft.sac_id,
    status:               'draft' as InvoiceStatus,
  }
}

// ─── List ────────────────────────────────────────────────────

export async function getInvoices(): Promise<InvoiceWithDetails[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients(name),
      client_gstins(gstin, address),
      work_orders(wo_reference),
      invoice_line_items(*),
      invoice_vehicles(*, vehicles(reg_number, vehicle_type))
    `)
    .order('created_at', { ascending: false })
  if (error) { console.error('getInvoices:', error); return [] }
  return (data ?? []).map(mapInvoiceRow)
}

export async function getInvoiceByNumber(invoiceNumber: string): Promise<InvoiceWithDetails | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients(name),
      client_gstins(gstin, address),
      work_orders(wo_reference),
      invoice_line_items(*),
      invoice_vehicles(*, vehicles(reg_number, vehicle_type))
    `)
    .eq('invoice_number', invoiceNumber)
    .single()
  if (error) { console.error('getInvoiceByNumber:', error); return null }
  return mapInvoiceRow(data)
}

function mapInvoiceRow(row: any): InvoiceWithDetails {
  return {
    ...row,
    client_name:          row.clients?.name ?? null,
    client_gstin:         row.client_gstins?.gstin ?? null,
    client_address:       row.client_gstins?.address ?? null,
    work_order_reference: row.work_orders?.wo_reference ?? null,
    line_items:           (row.invoice_line_items ?? []) as InvoiceLineItem[],
    vehicles:             (row.invoice_vehicles ?? []).map((iv: any) => ({
      ...iv,
      reg_number:   iv.vehicles?.reg_number ?? '',
      vehicle_type: iv.vehicles?.vehicle_type ?? null,
    })),
    // clean up joined keys
    clients: undefined, client_gstins: undefined,
    work_orders: undefined, invoice_line_items: undefined, invoice_vehicles: undefined,
  }
}

// ─── Save Draft ───────────────────────────────────────────────
// Upserts the invoice header (by invoice_number), then replaces
// line_items and vehicles. Safe to call at any wizard section.

export async function saveDraftInvoice(draft: InvoiceDraft): Promise<Invoice | null> {
  // 1. Upsert header
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .upsert(draftToRow(draft), { onConflict: 'invoice_number' })
    .select()
    .single()
  if (invErr) { console.error('saveDraftInvoice header:', invErr); return null }

  const invoiceId = inv.id

  // 2. Replace line items
  await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId)
  if (draft.line_items.length > 0) {
    const itemRows = draft.line_items.map((item, i) => ({
      invoice_id:         invoiceId,
      work_order_item_id: item.work_order_item_id,
      sl_no:              item.sl_no ?? i + 1,
      description:        item.description,
      sac_id:             item.sac_id,
      unit:               item.unit,
      qty:                item.qty,
      rate:               item.rate,
      taxable_value:      item.taxable_value,
      rate_overridden:    item.rate_overridden,
    }))
    const { error: itemErr } = await supabase.from('invoice_line_items').insert(itemRows)
    if (itemErr) console.error('saveDraftInvoice items:', itemErr)
  }

  // 3. Replace vehicles
  await supabase.from('invoice_vehicles').delete().eq('invoice_id', invoiceId)
  if (draft.vehicles.length > 0) {
    const vehicleRows = draft.vehicles.map(v => ({
      invoice_id:             invoiceId,
      vehicle_id:             v.vehicle_id,
      include_in_description: v.include_in_description,
    }))
    const { error: vErr } = await supabase.from('invoice_vehicles').insert(vehicleRows)
    if (vErr) console.error('saveDraftInvoice vehicles:', vErr)
  }

  return inv
}

// ─── Finalize Invoice ─────────────────────────────────────────
// 1. Saves the final draft
// 2. Sets status = 'final'
// 3. Updates cumulative_billed_qty on linked work_order_items

export async function finalizeInvoice(draft: InvoiceDraft): Promise<Invoice | null> {
  // Save latest draft first
  const inv = await saveDraftInvoice(draft)
  if (!inv) return null

  // Set status to final
  const { data: finalInv, error: finalErr } = await supabase
    .from('invoices')
    .update({ status: 'final' })
    .eq('id', inv.id)
    .select()
    .single()
  if (finalErr) { console.error('finalizeInvoice status:', finalErr); return null }

  // Update cumulative_billed_qty for each linked work_order_item
  for (const item of draft.line_items) {
    if (!item.work_order_item_id || item.qty <= 0) continue
    const { error: qtyErr } = await supabase.rpc('increment_billed_qty', {
      p_item_id: item.work_order_item_id,
      p_qty:     item.qty,
    })
    if (qtyErr) console.error('increment_billed_qty:', qtyErr)
  }

  return finalInv
}

// ─── Cancel Invoice ───────────────────────────────────────────
export async function cancelInvoice(invoiceId: number): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', invoiceId)
  if (error) console.error('cancelInvoice:', error)
}
