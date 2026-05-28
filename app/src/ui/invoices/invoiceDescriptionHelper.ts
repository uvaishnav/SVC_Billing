import { supabase } from '../../db/supabaseClient'
import type { InvoiceDraft } from '../../db/types'

interface RentalItemContext {
  reg_number:   string
  vehicle_type: string | null
  billing_mode: 'full_month' | 'partial_days'
  num_days:     number | null
  monthly_rent: number
  subtotal:     number
}

interface DescriptionPayload {
  client_name:  string
  billing_from: string
  billing_to:   string
  billing_type: 'quantity' | 'rental'
  wo_reference?: string
  wo_subject?:   string
  // quantity mode
  line_items: { description: string; qty: number; unit: string | null; rate: number }[]
  // rental mode
  rental_items: RentalItemContext[]
  vehicles: { reg_number: string; vehicle_type: string | null; include_in_description: boolean }[]
  existing_description?:   string
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
  draft:      InvoiceDraft,
  clientName: string,
  woSubject?:  string,
  woReference?: string,
  refinementInstruction?: string
): DescriptionPayload {
  const isRental = draft.line_item_billing_type === 'rental'

  return {
    client_name:  clientName,
    billing_from: draft.billing_from,
    billing_to:   draft.billing_to,
    billing_type: draft.line_item_billing_type,
    wo_reference: woReference,
    wo_subject:   woSubject,

    // Quantity mode: pass line items as before
    line_items: isRental
      ? []
      : draft.line_items.map(i => ({
          description: i.description,
          qty:  i.qty,
          unit: i.unit,
          rate: i.rate,
        })),

    // Rental mode: pass rental rows with full context
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
    existing_description:   refinementInstruction ? draft.overall_description : undefined,
    refinement_instruction: refinementInstruction,
  }
}
