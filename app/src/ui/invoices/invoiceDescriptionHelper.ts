import { supabase } from '../../db/supabaseClient'
import type { InvoiceDraft } from '../../db/types'

interface DescriptionPayload {
  client_name: string
  billing_from: string
  billing_to: string
  wo_reference?: string
  wo_subject?: string
  line_items: { description: string; qty: number; unit: string | null }[]
  vehicles: { reg_number: string; vehicle_type: string | null; include_in_description: boolean }[]
  existing_description?: string
  refinement_instruction?: string
}

export async function generateInvoiceDescription(
  payload: DescriptionPayload
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice-description`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    }
  )

  if (!res.ok) {
    console.error('generateInvoiceDescription failed:', await res.text())
    return null
  }
  const { description } = await res.json()
  return description ?? null
}

export function buildDescriptionPayload(
  draft: InvoiceDraft,
  clientName: string,
  woSubject?: string,
  woReference?: string,
  refinementInstruction?: string
): DescriptionPayload {
  return {
    client_name:  clientName,
    billing_from: draft.billing_from,
    billing_to:   draft.billing_to,
    wo_reference: woReference,
    wo_subject:   woSubject,
    line_items:   draft.line_items.map(i => ({ description: i.description, qty: i.qty, unit: i.unit })),
    vehicles:     draft.vehicles,
    existing_description:    refinementInstruction ? draft.overall_description : undefined,
    refinement_instruction:  refinementInstruction,
  }
}
