// Frontend helper to call the generate-invoice-description edge function.
// Handles both initial generation and user-driven refinement.
//
// What we send to the AI (intentionally minimal):
//   - billing period, WO reference, WO subject, billing type
//   - sac_description: internal context only (AI must NOT mention it in output)
//   - work_item_descriptions: sent for BOTH quantity and rental modes
//     (rental vehicles support some work — describing it makes the description richer)
//   - quantity mode: vehicles marked include_in_description
//   - rental mode: rental items with reg_number, vehicle_type, billing_mode, num_days (no money)
//
// What we deliberately do NOT send:
//   - client_name (already on the invoice header)
//   - rates, quantities, amounts, subtotals (already in the bill table)

import { supabase } from '../db/supabaseClient'
import type { InvoiceDraft } from '../db/types'

export interface DescriptionContext {
  draft:           InvoiceDraft
  // client_name intentionally removed — already on invoice header
  wo_reference:    string | null
  wo_subject:      string | null
  sac_description: string | null  // sent as internal context only; AI must not repeat it
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
  const { draft, wo_reference, wo_subject, sac_description } = ctx
  const isRental = draft.line_item_billing_type === 'rental'

  return {
    billing_from:    draft.billing_from,
    billing_to:      draft.billing_to,
    billing_type:    draft.line_item_billing_type,
    wo_reference,
    wo_subject,
    // Sent as internal context only — AI is instructed not to mention SAC code or nickname
    sac_description,

    // Work item descriptions sent for BOTH modes — rental vehicles also support real work
    // and having the line item descriptions helps the AI describe what the vehicles were doing
    work_item_descriptions: draft.line_items.map(i => i.description).filter(Boolean),

    // Quantity mode only: vehicles explicitly marked for description inclusion
    vehicles: isRental
      ? []
      : draft.vehicles
          .filter(v => v.include_in_description)
          .map(v => ({ reg_number: v.reg_number, vehicle_type: v.vehicle_type })),

    // Rental mode: vehicle deployment info — no money fields
    rental_items: isRental
      ? draft.rental_items
          .filter(ri => ri.vehicle_id !== null)
          .map(ri => ({
            reg_number:   ri.reg_number,
            vehicle_type: ri.vehicle_type,
            billing_mode: ri.billing_mode,
            num_days:     ri.num_days,
          }))
      : [],

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
