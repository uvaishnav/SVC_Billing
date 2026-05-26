import { supabase } from './supabaseClient'
import type { Invoice, InvoiceWithDetails, InvoiceLineItem, InvoiceVehicle, InvoiceDraft, InvoiceStatus } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────

/** Detect tax mode: IGST if client state_code != business state_code */
export function detectTaxMode(
  clientStateCode: string,
  businessStateCode: string
): 'cgst_sgst' | 'igst' {
  return clientStateCode.trim() === businessStateCode.trim() ? 'cgst_sgst' : 'igst'
}

/** Compute financial totals from line items */
export function computeTotals(draft: Pick<InvoiceDraft, 'line_items' | 'gst_rate' | 'tds_rate'> & { tds_applicable: boolean }) {
  const total_taxable = draft.line_items.reduce((s, i) => s + i.taxable_value, 0)
  const total_gst     = parseFloat((total_taxable * draft.gst_rate / 100).toFixed(2))
  const total_amount  = parseFloat((total_taxable + total_gst).toFixed(2))
  const tds_amount    = draft.tds_applicable ? parseFloat((total_taxable * draft.tds_rate / 100).toFixed(2)) : 0
  const net_receivable = parseFloat((total_amount - tds_amount).toFixed(2))
  return { total_taxable: parseFloat(total_taxable.toFixed(2)), total_gst, total_amount, tds_amount, net_receivable }
}

// ─── List ───────────────────────────────────────────────────────────

export async function getInvoices(): Promise<InvoiceWithDetails[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients(name),
      client_gstins(gstin),
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
      client_gstins(gstin),
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
    client_name:           row.clients?.name ?? null,
    client_gstin:          row.client_gstins?.gstin ?? null,
    work_order_reference:  row.work_orders?.wo_reference ?? null,
    line_items:            row.invoice_line_items ?? [],
    vehicles: (row.invoice_vehicles ?? []).map((iv: any) => ({
      ...iv,
      reg_number:   iv.vehicles?.reg_number ?? '',
      vehicle_type: iv.vehicles?.vehicle_type ?? null,
      vehicles: undefined,
    })),
    clients: undefined,
    client_gstins: undefined,
    work_orders: undefined,
    invoice_line_items: undefined,
    invoice_vehicles: undefined,
  }
}

// ─── Save Draft ──────────────────────────────────────────────────

/**
 * Upsert an invoice draft (or any status).
 * invoice_number is the stable PK used for upsert — generated at wizard open.
 * Line items and vehicles are replaced on every save (clean replace pattern).
 */
export async function saveInvoiceDraft(
  draft: InvoiceDraft,
  tds_applicable: boolean
): Promise<boolean> {
  const totals = computeTotals({ ...draft, tds_applicable })

  const cgst_amount = draft.tax_mode === 'cgst_sgst' ? parseFloat((totals.total_gst / 2).toFixed(2)) : 0
  const sgst_amount = draft.tax_mode === 'cgst_sgst' ? parseFloat((totals.total_gst / 2).toFixed(2)) : 0
  const igst_amount = draft.tax_mode === 'igst' ? totals.total_gst : 0

  const invoiceRow = {
    invoice_number:      draft.invoice_number,
    status:              'draft' as InvoiceStatus,
    client_id:           draft.client_id,
    client_gstin_id:     draft.client_gstin_id,
    tax_mode:            draft.tax_mode,
    reverse_charge:      false,
    work_order_id:       draft.work_order_id,
    invoice_date:        draft.invoice_date,
    billing_from:        draft.billing_from,
    billing_to:          draft.billing_to,
    sac_id:              draft.sac_id,
    bank_account_id:     draft.bank_account_id,
    overall_description: draft.overall_description || null,
    gst_rate:            draft.gst_rate,
    tds_rate:            draft.tds_rate,
    ...totals,
    cgst_amount,
    sgst_amount,
    igst_amount,
  }

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .upsert(invoiceRow, { onConflict: 'invoice_number' })
    .select('id')
    .single()
  if (invErr) { console.error('saveInvoiceDraft invoice:', invErr); return false }

  const invoiceId = inv.id

  // Replace line items
  await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId)
  if (draft.line_items.length > 0) {
    const itemRows = draft.line_items.map((item, i) => ({
      invoice_id:          invoiceId,
      work_order_item_id:  item.work_order_item_id,
      sl_no:               item.sl_no ?? i + 1,
      description:         item.description,
      sac_id:              draft.sac_id,
      unit:                item.unit,
      qty:                 item.qty,
      rate:                item.rate,
      rate_overridden:     item.rate_overridden,
      taxable_value:       item.taxable_value,
    }))
    const { error: itemErr } = await supabase.from('invoice_line_items').insert(itemRows)
    if (itemErr) { console.error('saveInvoiceDraft items:', itemErr); return false }
  }

  // Replace vehicles
  await supabase.from('invoice_vehicles').delete().eq('invoice_id', invoiceId)
  if (draft.vehicles.length > 0) {
    const vehicleRows = draft.vehicles.map(v => ({
      invoice_id:             invoiceId,
      vehicle_id:             v.vehicle_id,
      include_in_description: v.include_in_description,
    }))
    const { error: vErr } = await supabase.from('invoice_vehicles').insert(vehicleRows)
    if (vErr) { console.error('saveInvoiceDraft vehicles:', vErr); return false }
  }

  return true
}

// ─── Finalize Invoice ─────────────────────────────────────────────

/**
 * Finalize: set status = 'final', update cumulative_billed_qty on WO items.
 * Called from the Review section after user confirms.
 */
export async function finalizeInvoice(
  draft: InvoiceDraft,
  tds_applicable: boolean
): Promise<boolean> {
  // First do a full save with latest data
  const saved = await saveInvoiceDraft(draft, tds_applicable)
  if (!saved) return false

  // Set status to final
  const { error: statusErr } = await supabase
    .from('invoices')
    .update({ status: 'final' })
    .eq('invoice_number', draft.invoice_number)
  if (statusErr) { console.error('finalizeInvoice status:', statusErr); return false }

  // Update cumulative_billed_qty on each linked WO item
  for (const item of draft.line_items) {
    if (!item.work_order_item_id) continue
    const { error: qtyErr } = await supabase.rpc('increment_billed_qty', {
      p_item_id: item.work_order_item_id,
      p_qty:     item.qty,
    })
    if (qtyErr) console.error('finalizeInvoice increment_billed_qty:', qtyErr)
  }

  return true
}

// ─── Cancel Invoice ─────────────────────────────────────────────
export async function cancelInvoice(invoiceNumber: string): Promise<boolean> {
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('invoice_number', invoiceNumber)
  if (error) { console.error('cancelInvoice:', error); return false }
  return true
}
