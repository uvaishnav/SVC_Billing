// parseWorkOrder.ts
// Calls the parse-work-order Supabase Edge Function with OCR text.
// Returns the AI-parsed structured fields ready to prefill WorkOrderFormModal.

import { supabase } from '../db/supabaseClient'

export interface ParsedWorkOrder {
  wo_reference?:    string
  issue_date?:      string  // YYYY-MM-DD
  subject?:         string
  duration_months?: number
  total_value?:     number
  rates_firm?:      boolean
  tds_applicable?:  boolean
  billing_type?:    'monthly_ra' | 'milestone' | 'adhoc'
  items?: Array<{
    description:    string
    sub_work_ref?:  string
    unit?:          string
    contracted_qty?: number
    rate:           number
  }>
}

export async function parseWorkOrderText(ocrText: string): Promise<ParsedWorkOrder> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-work-order`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ ocr_text: ocrText }),
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `Edge Function error: ${res.status}`)
  }

  const { parsed } = await res.json()
  return parsed as ParsedWorkOrder
}
