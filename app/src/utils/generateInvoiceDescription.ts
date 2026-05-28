// Frontend helper to call the generate-invoice-description edge function.
// Handles both initial generation and user-driven refinement.

import { supabase } from '../db/supabaseClient'
import type { InvoiceDraft } from '../db/types'

export interface DescriptionContext {
  draft: InvoiceDraft
  client_name: string
  wo_reference: string | null
  wo_subject: string | null
  sac_description: string | null
}

export interface RefinementContext extends DescriptionContext {
  existing_description: string
  refinement_instruction: string
}

async function callEdgeFunction(body: object): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice-description`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `Edge function error ${res.status}`)
  }

  const data = await res.json()
  return data.description as string
}

/** Generate a fresh description from invoice draft context */
export async function generateInvoiceDescription(ctx: DescriptionContext): Promise<string> {
  const { draft, client_name, wo_reference, wo_subject, sac_description } = ctx

  return callEdgeFunction({
    client_name,
    billing_from:            draft.billing_from,
    billing_to:              draft.billing_to,
    wo_reference,
    wo_subject,
    sac_description,
    line_items: draft.line_items.map(i => ({
      description: i.description,
      unit:        i.unit,
      qty:         i.qty,
      rate:        i.rate,
    })),
    vehicles:                draft.vehicles,
    refinement_instruction:  null,
    existing_description:    null,
  })
}

/** Refine an existing description based on user instruction */
export async function refineInvoiceDescription(
  ctx: DescriptionContext,
  existingDescription: string,
  refinementInstruction: string,
): Promise<string> {
  const { draft, client_name, wo_reference, wo_subject, sac_description } = ctx

  return callEdgeFunction({
    client_name,
    billing_from:            draft.billing_from,
    billing_to:              draft.billing_to,
    wo_reference,
    wo_subject,
    sac_description,
    line_items: draft.line_items.map(i => ({
      description: i.description,
      unit:        i.unit,
      qty:         i.qty,
      rate:        i.rate,
    })),
    vehicles:                draft.vehicles,
    refinement_instruction:  refinementInstruction,
    existing_description:    existingDescription,
  })
}
