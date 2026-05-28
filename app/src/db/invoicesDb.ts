import { supabase } from './supabaseClient'
import type {
  Invoice, InvoiceLineItem, InvoiceVehicle,
  InvoiceWithDetails, InvoiceDraft, InvoiceStatus
} from './types'
import { generateInvoiceNumber } from '../utils/invoiceNumbering'

// ─── Helpers ─────────────────────────────────────────────────

function draftToRow(
  draft: InvoiceDraft,
  status: InvoiceStatus = 'draft',
): Omit<Invoice, 'id' | 'created_at' | 'updated_at'> {
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
    status,
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
    clients: undefined, client_gstins: undefined,
    work_orders: undefined, invoice_line_items: undefined, invoice_vehicles: undefined,
  }
}

// ─── Save Draft ───────────────────────────────────────────────
// Upserts invoice header + replaces line_items and vehicles.
// invoice_number for new drafts is 'DRAFT' — never a real number.

export async function saveDraftInvoice(draft: InvoiceDraft): Promise<Invoice | null> {
  const row = draftToRow(draft, 'draft')

  // For brand-new drafts, use a stable unique placeholder
  // so upsert by invoice_number works consistently.
  if (!row.invoice_number || row.invoice_number === 'DRAFT') {
    // Generate a collision-free draft key: DRAFT-<timestamp>
    // Only set on very first save — if already has DRAFT-xxx keep it
    row.invoice_number = draft.invoice_number?.startsWith('DRAFT-')
      ? draft.invoice_number
      : `DRAFT-${Date.now()}`
  }

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .upsert(row, { onConflict: 'invoice_number' })
    .select()
    .single()
  if (invErr) { console.error('saveDraftInvoice header:', invErr); return null }

  const invoiceId = inv.id

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

  return { ...inv, invoice_number: row.invoice_number }
}

// ─── Finalize Invoice ─────────────────────────────────────────
// INVOICE NUMBER ASSIGNMENT RULES:
//   - Already final (editing a finalized invoice): keep existing number — NEVER reassign
//   - Draft or new: call generate-invoice-number edge fn → assign real number now
//
// Sequence: assign number → save → set status=final → update billed qty

export async function finalizeInvoice(
  draft: InvoiceDraft,
  currentStatus?: InvoiceStatus,   // pass 'final' when editing an existing final invoice
): Promise<{ invoice: Invoice; invoiceNumber: string } | null> {

  // ── Step 1: Determine invoice number ──────────────────────
  let invoiceNumber = draft.invoice_number

  const isAlreadyFinal = currentStatus === 'final' ||
    (!!invoiceNumber && !invoiceNumber.startsWith('DRAFT') && invoiceNumber !== 'DRAFT')

  if (!isAlreadyFinal) {
    // New invoice or draft → generate a real number NOW (only moment we call the RPC)
    const generated = await generateInvoiceNumber()
    if (!generated) throw new Error('Could not generate invoice number. Check settings configuration.')
    invoiceNumber = generated
  }
  // If already final: invoiceNumber stays exactly as-is — locked forever

  // ── Step 2: Save with real invoice number ─────────────────
  const draftWithNumber: InvoiceDraft = { ...draft, invoice_number: invoiceNumber }
  const row = draftToRow(draftWithNumber, 'final')

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .upsert(row, { onConflict: 'invoice_number' })
    .select()
    .single()
  if (invErr) { console.error('finalizeInvoice upsert:', invErr); return null }

  const invoiceId = inv.id

  // ── Step 3: Replace line items ────────────────────────────
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
    if (itemErr) console.error('finalizeInvoice items:', itemErr)
  }

  // ── Step 4: Replace vehicles ──────────────────────────────
  await supabase.from('invoice_vehicles').delete().eq('invoice_id', invoiceId)
  if (draft.vehicles.length > 0) {
    const vehicleRows = draft.vehicles.map(v => ({
      invoice_id:             invoiceId,
      vehicle_id:             v.vehicle_id,
      include_in_description: v.include_in_description,
    }))
    const { error: vErr } = await supabase.from('invoice_vehicles').insert(vehicleRows)
    if (vErr) console.error('finalizeInvoice vehicles:', vErr)
  }

  // ── Step 5: Update cumulative billed qty (only for new finalizations) ──
  if (!isAlreadyFinal) {
    for (const item of draft.line_items) {
      if (!item.work_order_item_id || item.qty <= 0) continue
      const { error: qtyErr } = await supabase.rpc('increment_billed_qty', {
        p_item_id: item.work_order_item_id,
        p_qty:     item.qty,
      })
      if (qtyErr) console.error('increment_billed_qty:', qtyErr)
    }
  }

  return { invoice: inv, invoiceNumber }
}

// ─── Cancel Invoice ───────────────────────────────────────────
export async function cancelInvoice(invoiceId: number): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', invoiceId)
  if (error) console.error('cancelInvoice:', error)
}
