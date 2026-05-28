// Central wizard state hook.
// Holds InvoiceDraft, exposes updaters, handles draft save.
import { useState, useCallback } from 'react'
import type { InvoiceDraft, InvoiceLineDraft, InvoiceVehicleDraft, TaxMode } from '../../db/types'
import { saveDraftInvoice } from '../../db/invoicesDb'

// ─── Date helpers ─────────────────────────────────────────────

// NEVER use toISOString() for local date formatting.
// toISOString() converts to UTC, so midnight IST (UTC+5:30)
// becomes the previous day in UTC — causing off-by-one date bugs.
// Instead, read local year/month/day directly from the Date object.
function localISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function prevMonthRange(): { from: string; to: string } {
  const now = new Date()
  // First day of previous month (local)
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  // Last day of previous month = day 0 of current month (local)
  const to   = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from: localISO(from), to: localISO(to) }
}

function today(): string {
  return localISO(new Date())
}

export function emptyDraft(): InvoiceDraft {
  const { from, to } = prevMonthRange()
  return {
    invoice_number:       '',
    invoice_date:         today(),
    billing_from:         from,
    billing_to:           to,
    client_id:            null,
    client_gstin_id:      null,
    work_order_id:        null,
    sac_id:               null,
    bank_account_id:      null,
    tax_mode:             'cgst_sgst',
    place_of_supply:      '',
    place_of_supply_code: '',
    reverse_charge:       false,
    line_items:           [],
    vehicles:             [],
    overall_description:  '',
    total_taxable:        0,
    gst_rate:             18,
    total_gst:            0,
    total_amount:         0,
    tds_rate:             0,
    tds_amount:           0,
    net_receivable:       0,
    amount_in_words:      '',
  }
}

/** Recompute all financial totals from line items */
export function recomputeTotals(
  draft: InvoiceDraft,
  gstRate: number,
  tdsRate: number,
): InvoiceDraft {
  const total_taxable  = draft.line_items.reduce((s, i) => s + i.taxable_value, 0)
  const total_gst      = parseFloat((total_taxable * gstRate / 100).toFixed(2))
  const total_amount   = parseFloat((total_taxable + total_gst).toFixed(2))
  const tds_amount     = parseFloat((total_taxable * tdsRate / 100).toFixed(2))
  const net_receivable = parseFloat((total_amount - tds_amount).toFixed(2))
  return {
    ...draft,
    gst_rate:      gstRate,
    tds_rate:      tdsRate,
    total_taxable,
    total_gst,
    total_amount,
    tds_amount,
    net_receivable,
    amount_in_words: amountToWords(total_amount),
  }
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

export interface SectionStatus {
  visited: boolean
  complete: boolean
}

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
    case 2: return draft.line_items.length > 0 && draft.line_items.every(i => i.qty > 0)
    case 3: return draft.overall_description.trim().length > 0
    case 4: return true
  }
}

export function useInvoiceDraft(initialDraft?: InvoiceDraft) {
  const [draft, setDraft] = useState<InvoiceDraft>(initialDraft ?? emptyDraft())
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<WizardSection>(1)
  const [visitedSections, setVisitedSections] = useState<Set<WizardSection>>(new Set([1]))

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

  const goToSection = useCallback((s: WizardSection) => {
    setActiveSection(s)
    setVisitedSections(prev => new Set([...prev, s]))
  }, [])

  const saveDraft = useCallback(async () => {
    setSaving(true)
    await saveDraftInvoice(draft)
    setSaving(false)
  }, [draft])

  return {
    draft, patch, patchLineItem, setLineItems, setVehicles,
    activeSection, goToSection, visitedSections,
    saving, saveDraft,
  }
}
