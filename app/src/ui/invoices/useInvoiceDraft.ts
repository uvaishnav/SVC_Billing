// Central wizard state hook.
// Holds InvoiceDraft, exposes updaters, handles draft save.
import { useState, useCallback } from 'react'
import type {
  InvoiceDraft, InvoiceLineDraft, InvoiceVehicleDraft,
  InvoiceRentalItemDraft, InvoiceItemDistributionDraft,
  TaxMode, InvoiceBillingType,
} from '../../db/types'
import { saveDraftInvoice } from '../../db/invoicesDb'

// ─── Date helpers ─────────────────────────────────────────────────
// NEVER use toISOString() for local date formatting.
// toISOString() converts to UTC, so midnight IST (UTC+5:30)
// becomes the previous day in UTC — causing off-by-one date bugs.
function localISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Returns the first and last date of the month BEFORE the given base date.
 * baseDate defaults to today when not provided (used for emptyDraft).
 * When invoice_date changes, pass the new date here so billing_from/to
 * track the previous month relative to the selected invoice date.
 */
export function prevMonthRange(baseDate?: Date): { from: string; to: string } {
  const ref = baseDate ?? new Date()
  const from = new Date(ref.getFullYear(), ref.getMonth() - 1, 1)
  const to   = new Date(ref.getFullYear(), ref.getMonth(), 0)
  return { from: localISO(from), to: localISO(to) }
}

function today(): string { return localISO(new Date()) }

export function emptyDraft(): InvoiceDraft {
  const { from, to } = prevMonthRange()
  return {
    invoice_number:          '',
    invoice_date:            today(),
    billing_from:            from,
    billing_to:              to,
    client_id:               null,
    client_gstin_id:         null,
    work_order_id:           null,
    sac_id:                  null,
    bank_account_id:         null,
    tax_mode:                'cgst_sgst',
    place_of_supply:         '',
    place_of_supply_code:    '',
    reverse_charge:          false,
    line_item_billing_type:  'quantity',   // default
    line_items:              [],
    rental_items:            [],
    item_distribution:       [],
    vehicles:                [],
    overall_description:     '',
    total_taxable:           0,
    gst_rate:                18,
    cgst_amount:             0,
    sgst_amount:             0,
    igst_amount:             0,
    total_gst:               0,
    total_amount:            0,
    tds_rate:                0,
    tds_amount:              0,
    net_receivable:          0,
    amount_in_words:         '',
  }
}

/** Recompute all financial totals.
 *  Works for both billing types:
 *   - quantity: sum of line_items[].taxable_value
 *   - rental:   sum of rental_items[].subtotal
 *
 *  Also derives split GST amounts (cgst/sgst vs igst) from tax_mode.
 *  These are persisted to the DB so buildInvoicePayload can read them back.
 */
export function recomputeTotals(
  draft: InvoiceDraft,
  gstRate: number,
  tdsRate: number,
): InvoiceDraft {
  const total_taxable =
    draft.line_item_billing_type === 'rental'
      ? draft.rental_items.reduce((s, ri) => s + ri.subtotal, 0)
      : draft.line_items.reduce((s, i) => s + i.taxable_value, 0)

  const total_taxable_rounded = parseFloat(total_taxable.toFixed(2))
  const total_gst      = parseFloat((total_taxable_rounded * gstRate / 100).toFixed(2))
  const total_amount   = parseFloat((total_taxable_rounded + total_gst).toFixed(2))
  const tds_amount     = parseFloat((total_taxable_rounded * tdsRate / 100).toFixed(2))
  const net_receivable = parseFloat((total_amount - tds_amount).toFixed(2))

  // Derive split GST amounts based on tax mode
  const half = parseFloat((total_gst / 2).toFixed(2))
  const cgst_amount = draft.tax_mode === 'cgst_sgst' ? half : 0
  const sgst_amount = draft.tax_mode === 'cgst_sgst' ? half : 0
  const igst_amount = draft.tax_mode === 'igst'      ? total_gst : 0

  return {
    ...draft,
    gst_rate:      gstRate,
    tds_rate:      tdsRate,
    total_taxable: total_taxable_rounded,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_gst,
    total_amount,
    tds_amount,
    net_receivable,
    amount_in_words: amountToWords(total_amount),
  }
}

/** Compute rental item subtotal from billing mode fields. */
export function computeRentalSubtotal(
  monthlyRent: number,
  billingMode: 'full_month' | 'partial_days',
  numDays: number | null,
  dayNightShift?: boolean,
  shiftMultiplier?: number | null,
): number {
  const baseRent = dayNightShift && shiftMultiplier && shiftMultiplier > 1
    ? monthlyRent * shiftMultiplier
    : monthlyRent
  if (billingMode === 'full_month') return parseFloat(baseRent.toFixed(2))
  if (!numDays || numDays <= 0)    return 0
  return parseFloat(((baseRent / 30) * numDays).toFixed(2))
}

/** Re-distribute total_taxable equally across all distribution rows,
 *  then let the user override individually (done in Section 2 UI). */
export function equalSplitDistribution(
  distribution: InvoiceItemDistributionDraft[],
  totalTaxable: number,
): InvoiceItemDistributionDraft[] {
  if (distribution.length === 0) return []
  const pct = parseFloat((100 / distribution.length).toFixed(3))
  return distribution.map((d, i) => {
    const thisPct = i === distribution.length - 1
      ? parseFloat((100 - pct * (distribution.length - 1)).toFixed(3))
      : pct
    return {
      ...d,
      allocation_pct:   thisPct,
      allocated_amount: parseFloat((totalTaxable * thisPct / 100).toFixed(2)),
    }
  })
}

// Basic Indian number-to-words (crore/lakh/thousand)
function amountToWords(amount: number): string {
  const n = Math.round(amount)
  if (n === 0) return 'Zero Rupees Only'
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function words(num: number): string {
    if (num === 0) return ''
    if (num < 20)  return ones[num] + ' '
    if (num < 100) return tens[Math.floor(num/10)] + ' ' + ones[num%10] + ' '
    if (num < 1000) return ones[Math.floor(num/100)] + ' Hundred ' + words(num%100)
    if (num < 100000) return words(Math.floor(num/1000)) + 'Thousand ' + words(num%1000)
    if (num < 10000000) return words(Math.floor(num/100000)) + 'Lakh ' + words(num%100000)
    return words(Math.floor(num/10000000)) + 'Crore ' + words(num%10000000)
  }
  return words(n).trim() + ' Rupees Only'
}

export type WizardSection = 1 | 2 | 3 | 4

export function isSectionComplete(draft: InvoiceDraft, section: WizardSection): boolean {
  switch (section) {
    case 1: return !!(
      draft.client_id &&
      draft.client_gstin_id &&
      draft.invoice_date &&
      draft.billing_from &&
      draft.billing_to &&
      draft.sac_id &&
      draft.bank_account_id
    )
    case 2:
      if (draft.line_item_billing_type === 'rental') {
        const hasItems = draft.rental_items.length > 0 && draft.rental_items.every(ri => ri.subtotal > 0)
        const distTotal = draft.item_distribution.reduce((s, d) => s + d.allocation_pct, 0)
        const distOk = draft.item_distribution.length === 0 || Math.abs(distTotal - 100) < 0.1
        return hasItems && distOk
      }
      return draft.line_items.length > 0 && draft.line_items.every(i => i.qty > 0)
    case 3: return draft.overall_description.trim().length > 0
    case 4: return true
  }
}

export function useInvoiceDraft(initialDraft?: InvoiceDraft, initialInvoiceId?: number | null) {
  const [draft, setDraft] = useState<InvoiceDraft>(initialDraft ?? emptyDraft())
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<WizardSection>(1)
  const [visitedSections, setVisitedSections] = useState<Set<WizardSection>>(new Set([1]))

  // Tracks the DB row id once the draft has been saved at least once.
  // This is the key that ensures saveDraft and finalizeInvoice always
  // UPDATE the same row rather than inserting a new one.
  const [savedInvoiceId, setSavedInvoiceId] = useState<number | null>(initialInvoiceId ?? null)

  const patch = useCallback((updates: Partial<InvoiceDraft>) => {
    setDraft(d => ({ ...d, ...updates }))
  }, [])

  const patchLineItem = useCallback((index: number, updates: Partial<InvoiceLineDraft>) => {
    setDraft(d => {
      const items = [...d.line_items]
      items[index] = { ...items[index], ...updates }
      items[index].taxable_value = parseFloat((items[index].qty * items[index].rate).toFixed(2))
      return { ...d, line_items: items }
    })
  }, [])

  const setLineItems = useCallback((items: InvoiceLineDraft[]) => {
    setDraft(d => ({ ...d, line_items: items }))
  }, [])

  const setVehicles = useCallback((vehicles: InvoiceVehicleDraft[]) => {
    setDraft(d => ({ ...d, vehicles }))
  }, [])

  const setRentalItems = useCallback((items: InvoiceRentalItemDraft[]) => {
    setDraft(d => ({ ...d, rental_items: items }))
  }, [])

  const setItemDistribution = useCallback((dist: InvoiceItemDistributionDraft[]) => {
    setDraft(d => ({ ...d, item_distribution: dist }))
  }, [])

  const goToSection = useCallback((s: WizardSection) => {
    setActiveSection(s)
    setVisitedSections(prev => new Set([...prev, s]))
  }, [])

  const saveDraft = useCallback(async () => {
    setSaving(true)
    const result = await saveDraftInvoice(draft, savedInvoiceId)
    if (result) {
      // Capture the id from the first INSERT so all future saves UPDATE the same row
      setSavedInvoiceId(result.savedId)
      // Patch the invoice_number back into draft state (in case it was auto-generated)
      setDraft(d => ({ ...d, invoice_number: result.invoice.invoice_number }))
    }
    setSaving(false)
    return result
  }, [draft, savedInvoiceId])

  return {
    draft, patch, patchLineItem,
    setLineItems, setVehicles,
    setRentalItems, setItemDistribution,
    activeSection, goToSection, visitedSections,
    saving, saveDraft,
    savedInvoiceId,
  }
}
