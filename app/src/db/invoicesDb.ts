import { supabase } from './supabaseClient'
import type {
  Invoice, InvoiceLineItem, InvoiceVehicle,
  InvoiceRentalItem, InvoiceItemDistribution,
  InvoiceWithDetails, InvoiceDraft, InvoiceStatus, InvoiceBillingType
} from './types'
import { generateInvoiceNumber } from '../utils/invoiceNumbering'

// ─── Helpers ─────────────────────────────────────────────────

function getFY(dateStr: string): string {
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const fyStart = month >= 4 ? year : year - 1
  const fyEnd = fyStart + 1
  return `${String(fyStart).slice(2)}-${String(fyEnd).slice(2)}`
}

function getBillingMonth(dateStr: string): string {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function draftToRow(
  draft: InvoiceDraft,
  status: InvoiceStatus = 'draft',
): Omit<Invoice, 'id' | 'created_at' | 'updated_at'> {
  return {
    invoice_number:          draft.invoice_number,
    invoice_date:            draft.invoice_date,
    billing_from:            draft.billing_from,
    billing_to:              draft.billing_to,
    client_id:               draft.client_id,
    client_gstin_id:         draft.client_gstin_id,
    work_order_id:           draft.work_order_id,
    tax_mode:                draft.tax_mode,
    place_of_supply:         draft.place_of_supply,
    place_of_supply_code:    draft.place_of_supply_code,
    reverse_charge:          draft.reverse_charge,
    line_item_billing_type:  draft.line_item_billing_type,
    total_taxable:           draft.total_taxable,
    gst_rate:                draft.gst_rate,
    total_gst:               draft.total_gst,
    total_amount:            draft.total_amount,
    tds_rate:                draft.tds_rate,
    tds_amount:              draft.tds_amount,
    net_receivable:          draft.net_receivable,
    amount_in_words:         draft.amount_in_words,
    overall_description:     draft.overall_description,
    bank_account_id:         draft.bank_account_id,
    sac_id:                  draft.sac_id,
    status,
  }
}

// ─── List + Fetch ─────────────────────────────────────────────

export async function getInvoices(): Promise<InvoiceWithDetails[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients(name),
      client_gstins(gstin, address),
      work_orders(wo_reference),
      invoice_line_items(*),
      invoice_vehicles(*, vehicles(reg_number, vehicle_type)),
      invoice_rental_items(*, vehicles(reg_number, vehicle_type)),
      invoice_item_distribution(*)
    `)
    .order('created_at', { ascending: false })
  if (error) { console.error('getInvoices:', error); return [] }
  return (data ?? []).map(mapInvoiceRow)
}

export async function getInvoiceById(id: number): Promise<InvoiceWithDetails | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients(name),
      client_gstins(gstin, address),
      work_orders(wo_reference),
      invoice_line_items(*),
      invoice_vehicles(*, vehicles(reg_number, vehicle_type)),
      invoice_rental_items(*, vehicles(reg_number, vehicle_type)),
      invoice_item_distribution(*)
    `)
    .eq('id', id)
    .single()
  if (error) { console.error('getInvoiceById:', error); return null }
  return mapInvoiceRow(data)
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
      invoice_vehicles(*, vehicles(reg_number, vehicle_type)),
      invoice_rental_items(*, vehicles(reg_number, vehicle_type)),
      invoice_item_distribution(*)
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
    rental_items: (row.invoice_rental_items ?? []).map((ri: any) => ({
      ...ri,
      reg_number:   ri.vehicles?.reg_number ?? null,
      vehicle_type: ri.vehicles?.vehicle_type ?? null,
      vehicles: undefined,
    })),
    item_distribution: (row.invoice_item_distribution ?? []) as InvoiceItemDistribution[],
    clients: undefined, client_gstins: undefined, work_orders: undefined,
    invoice_line_items: undefined, invoice_vehicles: undefined,
    invoice_rental_items: undefined, invoice_item_distribution: undefined,
  }
}

/**
 * Converts a saved InvoiceWithDetails back into an InvoiceDraft
 * so it can be loaded into the wizard for editing.
 */
export function mapInvoiceWithDetailsToDraft(inv: InvoiceWithDetails): InvoiceDraft {
  return {
    invoice_number:          inv.invoice_number,
    invoice_date:            inv.invoice_date,
    billing_from:            inv.billing_from,
    billing_to:              inv.billing_to,
    client_id:               inv.client_id,
    client_gstin_id:         inv.client_gstin_id,
    work_order_id:           inv.work_order_id,
    sac_id:                  inv.sac_id,
    bank_account_id:         inv.bank_account_id,
    tax_mode:                inv.tax_mode,
    place_of_supply:         inv.place_of_supply,
    place_of_supply_code:    inv.place_of_supply_code,
    reverse_charge:          inv.reverse_charge,
    line_item_billing_type:  inv.line_item_billing_type,
    overall_description:     inv.overall_description ?? '',
    // Quantity invoice children
    line_items: inv.line_items.map(li => ({
      work_order_item_id: li.work_order_item_id,
      sl_no:              li.sl_no,
      description:        li.description,
      sac_id:             li.sac_id,
      unit:               li.unit,
      qty:                li.qty,
      rate:               li.rate,
      taxable_value:      li.taxable_value,
      rate_overridden:    li.rate_overridden,
    })),
    vehicles: inv.vehicles.map(v => ({
      vehicle_id:             v.vehicle_id,
      reg_number:             v.reg_number,
      vehicle_type:           v.vehicle_type,
      include_in_description: v.include_in_description,
    })),
    // Rental invoice children
    rental_items: inv.rental_items.map(ri => ({
      vehicle_id:   ri.vehicle_id,
      reg_number:   ri.reg_number ?? '',
      vehicle_type: ri.vehicle_type,
      billing_mode: ri.billing_mode,
      num_days:     ri.num_days,
      monthly_rent: ri.monthly_rent,
      subtotal:     ri.subtotal,
      sort_order:   ri.sort_order,
    })),
    item_distribution: inv.item_distribution.map(d => ({
      work_order_item_id: d.work_order_item_id,
      description:        '',   // not stored on InvoiceItemDistribution; will be empty
      sub_work_ref:       null,
      allocation_pct:     d.allocation_pct,
      allocated_amount:   d.allocated_amount,
    })),
    // Totals
    total_taxable:   inv.total_taxable,
    gst_rate:        inv.gst_rate,
    total_gst:       inv.total_gst,
    total_amount:    inv.total_amount,
    tds_rate:        inv.tds_rate,
    tds_amount:      inv.tds_amount,
    net_receivable:  inv.net_receivable,
    amount_in_words: inv.amount_in_words ?? '',
  }
}

// ─── Save Draft ───────────────────────────────────────────────

export async function saveDraftInvoice(draft: InvoiceDraft): Promise<Invoice | null> {
  const row = draftToRow(draft, 'draft')

  if (!row.invoice_number || row.invoice_number === 'DRAFT') {
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
  await _replaceChildren(invoiceId, draft)

  return { ...inv, invoice_number: row.invoice_number }
}

// ─── Finalize Invoice ─────────────────────────────────────────

export async function finalizeInvoice(
  draft: InvoiceDraft,
  currentStatus?: InvoiceStatus,
): Promise<{ invoice: Invoice; invoiceNumber: string } | null> {

  let invoiceNumber = draft.invoice_number
  const isAlreadyFinal = currentStatus === 'final' ||
    (!!invoiceNumber && !invoiceNumber.startsWith('DRAFT') && invoiceNumber !== 'DRAFT')

  if (!isAlreadyFinal) {
    const generated = await generateInvoiceNumber()
    if (!generated) throw new Error('Could not generate invoice number. Check settings configuration.')
    invoiceNumber = generated
  }

  const draftWithNumber: InvoiceDraft = { ...draft, invoice_number: invoiceNumber }
  const row = draftToRow(draftWithNumber, 'final')

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .upsert(row, { onConflict: 'invoice_number' })
    .select()
    .single()
  if (invErr) { console.error('finalizeInvoice upsert:', invErr); return null }

  const invoiceId = inv.id
  await _replaceChildren(invoiceId, draft)

  if (!isAlreadyFinal) {
    await _updateBilledQty(draft)
    await _writeVehicleLedger(invoiceId, draft, inv)
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
  await supabase.from('vehicle_billing_ledger').delete().eq('invoice_id', invoiceId)
}

// ─── Private helpers ──────────────────────────────────────────

async function _replaceChildren(invoiceId: number, draft: InvoiceDraft): Promise<void> {
  const billingType = draft.line_item_billing_type

  if (billingType === 'quantity') {
    await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId)
    if (draft.line_items.length > 0) {
      const { error } = await supabase.from('invoice_line_items').insert(
        draft.line_items.map((item, i) => ({
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
      )
      if (error) console.error('_replaceChildren line_items:', error)
    }

    await supabase.from('invoice_vehicles').delete().eq('invoice_id', invoiceId)
    if (draft.vehicles.length > 0) {
      const { error } = await supabase.from('invoice_vehicles').insert(
        draft.vehicles.map(v => ({
          invoice_id:             invoiceId,
          vehicle_id:             v.vehicle_id,
          include_in_description: v.include_in_description,
        }))
      )
      if (error) console.error('_replaceChildren vehicles:', error)
    }

  } else {
    await supabase.from('invoice_rental_items').delete().eq('invoice_id', invoiceId)
    if (draft.rental_items.length > 0) {
      const { error } = await supabase.from('invoice_rental_items').insert(
        draft.rental_items.map(ri => ({
          invoice_id:   invoiceId,
          vehicle_id:   ri.vehicle_id,
          sort_order:   ri.sort_order,
          billing_mode: ri.billing_mode,
          num_days:     ri.billing_mode === 'partial_days' ? ri.num_days : null,
          monthly_rent: ri.monthly_rent,
          subtotal:     ri.subtotal,
        }))
      )
      if (error) console.error('_replaceChildren rental_items:', error)
    }

    await supabase.from('invoice_item_distribution').delete().eq('invoice_id', invoiceId)
    if (draft.item_distribution.length > 0) {
      const { error } = await supabase.from('invoice_item_distribution').insert(
        draft.item_distribution.map(d => ({
          invoice_id:         invoiceId,
          work_order_item_id: d.work_order_item_id,
          allocation_pct:     d.allocation_pct,
          allocated_amount:   d.allocated_amount,
        }))
      )
      if (error) console.error('_replaceChildren item_distribution:', error)
    }
  }
}

async function _updateBilledQty(draft: InvoiceDraft): Promise<void> {
  if (draft.line_item_billing_type === 'quantity') {
    for (const item of draft.line_items) {
      if (!item.work_order_item_id || item.qty <= 0) continue
      const { error } = await supabase.rpc('increment_billed_qty', {
        p_item_id: item.work_order_item_id,
        p_qty:     item.qty,
      })
      if (error) console.error('increment_billed_qty (quantity):', error)
    }
  } else {
    for (const dist of draft.item_distribution) {
      if (!dist.work_order_item_id || dist.allocated_amount <= 0) continue
      const { data: woItem } = await supabase
        .from('work_order_items')
        .select('rate')
        .eq('id', dist.work_order_item_id)
        .single()
      if (!woItem || woItem.rate <= 0) continue
      const qtyEquivalent = dist.allocated_amount / woItem.rate
      const { error } = await supabase.rpc('increment_billed_qty', {
        p_item_id: dist.work_order_item_id,
        p_qty:     qtyEquivalent,
      })
      if (error) console.error('increment_billed_qty (rental):', error)
    }
  }
}

async function _writeVehicleLedger(
  invoiceId: number,
  draft: InvoiceDraft,
  inv: Invoice,
): Promise<void> {
  const financial_year = getFY(draft.invoice_date)
  const billing_month  = getBillingMonth(draft.billing_from)
  const work_order_id  = draft.work_order_id
  const billingType: InvoiceBillingType = draft.line_item_billing_type

  const ledgerRows: object[] = []

  if (billingType === 'rental') {
    for (const ri of draft.rental_items) {
      if (!ri.vehicle_id) continue
      ledgerRows.push({
        vehicle_id:     ri.vehicle_id,
        invoice_id:     invoiceId,
        work_order_id,
        financial_year,
        billing_month,
        billing_type:   'rental',
        amount:         ri.subtotal,
      })
    }
  } else {
    const vehicles = draft.vehicles.filter(v => v.vehicle_id)
    if (vehicles.length === 0) return
    const equalShare = Math.round((inv.total_taxable / vehicles.length) * 100) / 100
    for (const v of vehicles) {
      ledgerRows.push({
        vehicle_id:     v.vehicle_id,
        invoice_id:     invoiceId,
        work_order_id,
        financial_year,
        billing_month,
        billing_type:   'quantity',
        amount:         equalShare,
      })
    }
  }

  if (ledgerRows.length === 0) return

  const { error } = await supabase
    .from('vehicle_billing_ledger')
    .upsert(ledgerRows, { onConflict: 'vehicle_id,invoice_id', ignoreDuplicates: true })
  if (error) console.error('_writeVehicleLedger:', error)
}
