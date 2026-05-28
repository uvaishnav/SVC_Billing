// Frontend helper to call the generate-invoice-description edge function.
// Handles both initial generation and user-driven refinement.

import { supabase } from '../db/supabaseClient'
import type { InvoiceDraft } from '../db/types'

export interface DescriptionContext {
  draft:           InvoiceDraft
  client_name:     string
  wo_reference:    string | null
  wo_subject:      string | null
  sac_description: string | null
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

/** Build the common payload shared by generate and refine calls */
function buildPayload(
  ctx: DescriptionContext,
  extra: Record<string, unknown> = {}
): object {
  const { draft, client_name, wo_reference, wo_subject, sac_description } = ctx
  const isRental = draft.line_item_billing_type === 'rental'

  return {
    client_name,
    billing_from:    draft.billing_from,
    billing_to:      draft.billing_to,
    billing_type:    draft.line_item_billing_type,
    wo_reference,
    wo_subject,
    sac_description,

    // Quantity mode: send line items
    line_items: isRental
      ? []
      : draft.line_items.map(i => ({
          description: i.description,
          unit:        i.unit,
          qty:         i.qty,
          rate:        i.rate,
        })),

    // Rental mode: send rental rows (only confirmed vehicle rows)
    rental_items: isRental
      ? draft.rental_items
          .filter(ri => ri.vehicle_id !== null)
          .map(ri => ({
            reg_number:   ri.reg_number,
            vehicle_type: ri.vehicle_type,
            billing_mode: ri.billing_mode,
            num_days:     ri.num_days,
            monthly_rent: ri.monthly_rent,
            subtotal:     ri.subtotal,
          }))
      : [],

    vehicles: draft.vehicles,

    refinement_instruction: null,
    existing_description:   null,
    ...extra,
  }
}

/** Generate a fresh description from invoice draft context */
export async function generateInvoiceDescription(ctx: DescriptionContext): Promise<string> {
  return callEdgeFunction(buildPayload(ctx))
}

/** Refine an existing description based on user instruction */
export async function refineInvoiceDescription(
  ctx: DescriptionContext,
  existingDescription: string,
  refinementInstruction: string,
): Promise<string> {
  return callEdgeFunction(buildPayload(ctx, {
    existing_description:   existingDescription,
    refinement_instruction: refinementInstruction,
  }))
}
