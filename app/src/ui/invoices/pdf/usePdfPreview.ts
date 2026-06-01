/**
 * usePdfPreview.ts
 *
 * Hook that:
 *   1. Fetches all DB data needed to render the PDF (settings, client GSTIN,
 *      bank account, SAC code, work-order reference)
 *   2. Maps InvoiceDraft → InvoicePdfProps
 *   3. Uses @react-pdf/renderer pdf() to produce a Blob URL
 *   4. Exposes { open, close, pdfUrl, loading, error }
 *
 * Usage in Section4Review:
 *   const { open, close, pdfUrl, loading } = usePdfPreview(draft)
 */

import { useState, useCallback } from 'react'
import { pdf } from '@react-pdf/renderer'
import React from 'react'
import { InvoicePdf } from './InvoicePdf'
import type {
  InvoicePdfProps,
  PdfSupplier,
  PdfRecipient,
  PdfBankAccount,
  PdfLineItem,
  PdfRentalItem,
  PdfDistributionItem,
} from './invoicePayloadTypes'
import type { InvoiceDraft } from '../../../db/types'
import { supabase } from '../../../db/supabaseClient'

// ── DB helpers ─────────────────────────────────────────────────────

async function loadSettings() {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (error || !data) throw new Error('Could not load business settings')
  return data
}

async function loadClientGstin(id: number) {
  const { data } = await supabase
    .from('client_gstins')
    .select('gstin, state, state_code, address, clients(name)')
    .eq('id', id)
    .single()
  return data as {
    gstin: string
    state: string
    state_code: string
    address: string
    clients: { name: string } | null
  } | null
}

async function loadBankAccount(id: number) {
  const { data } = await supabase.from('bank_accounts').select('*').eq('id', id).single()
  return data as {
    bank_name: string
    account_name: string
    account_number: string
    ifsc: string
    branch: string | null
  } | null
}

async function loadSacCode(id: number) {
  const { data } = await supabase.from('sac_codes').select('sac_code').eq('id', id).single()
  return (data as { sac_code: string } | null)?.sac_code ?? null
}

async function loadWorkOrderRef(id: number) {
  const { data } = await supabase.from('work_orders').select('wo_reference').eq('id', id).single()
  return (data as { wo_reference: string | null } | null)?.wo_reference ?? null
}

// ── Draft → Props mapper ──────────────────────────────────────────────────

function buildProps(
  draft: InvoiceDraft,
  settings: Awaited<ReturnType<typeof loadSettings>>,
  clientGstin: Awaited<ReturnType<typeof loadClientGstin>>,
  bank: Awaited<ReturnType<typeof loadBankAccount>>,
  sacCode: string | null,
  woRef: string | null,
): InvoicePdfProps {

  const supplier: PdfSupplier = {
    business_name:        settings.business_name,
    address:              settings.address,
    gstin:                settings.gstin,
    pan:                  settings.pan,
    phone:                settings.phone,
    email:                settings.email,
    state:                settings.state,
    state_code:           settings.state_code,
    authorized_signatory: settings.authorized_signatory,
    logo_url:             settings.logo_url,
  }

  const recipient: PdfRecipient | null = clientGstin
    ? {
        name:       clientGstin.clients?.name ?? 'N/A',
        gstin:      clientGstin.gstin,
        address:    clientGstin.address,
        state:      clientGstin.state,
        state_code: clientGstin.state_code,
      }
    : null

  const bankAccount: PdfBankAccount | null = bank
    ? {
        bank_name:      bank.bank_name,
        account_name:   bank.account_name,
        account_number: bank.account_number,
        ifsc:           bank.ifsc,
        branch:         bank.branch,
      }
    : null

  const lineItems: PdfLineItem[] = draft.line_items.map(li => ({
    sl_no:       li.sl_no,
    description: li.description,
    unit:        li.unit,
    qty:         li.qty,
    rate:        li.rate,
    amount:      li.taxable_value,
  }))

  const rentalItems: PdfRentalItem[] = draft.rental_items.map((ri, idx) => ({
    sl_no:        idx + 1,
    reg_number:   ri.reg_number,
    vehicle_type: ri.vehicle_type,
    billing_from: draft.billing_from,
    billing_to:   draft.billing_to,
    billing_mode: ri.billing_mode,
    num_days:     ri.num_days,
    monthly_rent: ri.monthly_rent,
    amount:       ri.subtotal,
  }))

  const distribution: PdfDistributionItem[] = draft.item_distribution.map(d => ({
    description:    d.description,
    sub_work_ref:   d.sub_work_ref,
    allocation_pct: d.allocation_pct,
  }))

  return {
    supplier,
    recipient,
    invoice_number:        draft.invoice_number,
    invoice_date:          draft.invoice_date,
    billing_from:          draft.billing_from,
    billing_to:            draft.billing_to,
    place_of_supply:       draft.place_of_supply,
    place_of_supply_code:  draft.place_of_supply_code,
    // supplier_state_code: always from settings — OUR registration state code.
    // This is what appears as "State Code" in the Invoice Details block.
    supplier_state_code:   settings.state_code,
    reverse_charge:        draft.reverse_charge,
    work_order_reference:  woRef,
    billing_type:          draft.line_item_billing_type,
    tax_mode:              draft.tax_mode,
    sac_code:              sacCode,
    overall_description:   draft.overall_description,
    line_items:            lineItems,
    rental_items:          rentalItems,
    item_distribution:     distribution,
    total_taxable:         draft.total_taxable,
    gst_rate:              draft.gst_rate,
    total_gst:             draft.total_gst,
    total_amount:          draft.total_amount,
    tds_rate:              draft.tds_rate,
    tds_amount:            draft.tds_amount,
    net_receivable:        draft.net_receivable,
    amount_in_words:       draft.amount_in_words,
    bank:                  bankAccount,
  }
}

// ── Hook ────────────────────────────────────────────────────────────────

export function usePdfPreview(draft: InvoiceDraft) {
  const [pdfUrl,  setPdfUrl]  = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const open = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [settings, clientGstin, bank, sacCode, woRef] = await Promise.all([
        loadSettings(),
        draft.client_gstin_id ? loadClientGstin(draft.client_gstin_id) : Promise.resolve(null),
        draft.bank_account_id ? loadBankAccount(draft.bank_account_id) : Promise.resolve(null),
        draft.sac_id          ? loadSacCode(draft.sac_id)              : Promise.resolve(null),
        draft.work_order_id   ? loadWorkOrderRef(draft.work_order_id)  : Promise.resolve(null),
      ])

      const props = buildProps(draft, settings, clientGstin, bank, sacCode, woRef)
      const blob  = await pdf(React.createElement(InvoicePdf, props)).toBlob()
      const url   = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate PDF preview')
    } finally {
      setLoading(false)
    }
  }, [draft])

  const close = useCallback(() => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
    setError(null)
  }, [pdfUrl])

  return { open, close, pdfUrl, loading, error }
}
