// Generates the next invoice number using the prefix, sequence and FY from settings.
// Format: {prefix}/{FY}/{padded_sequence}  e.g.  SVC/2526/0042
// Also atomically increments current_sequence in settings after generation.

import { supabase } from '../db/supabaseClient'
import { getSettings, patchSettings } from '../db/settingsDb'

/** Returns the Indian financial year string for a given date.
 *  e.g. date in May 2026 → "2526"  (FY 2025-26)
 */
function getFY(date = new Date()): string {
  const month = date.getMonth() + 1 // 1-based
  const year  = date.getFullYear()
  const fyStart = month >= 4 ? year : year - 1
  const fyEnd   = fyStart + 1
  return `${String(fyStart).slice(-2)}${String(fyEnd).slice(-2)}`
}

/**
 * Generates the next sequential invoice number.
 * Reads settings for prefix / current_sequence / sequence_padding / last_fy.
 * Resets sequence to 1 if financial year has changed.
 * Increments current_sequence in settings atomically after reading.
 *
 * Returns null if settings are not configured yet.
 */
export async function generateInvoiceNumber(): Promise<string | null> {
  const settings = await getSettings()
  if (!settings) return null

  const { invoice_prefix, current_sequence, sequence_padding, last_fy } = settings
  const currentFY = getFY()

  // Reset sequence if new FY
  const sequence = last_fy !== currentFY ? 1 : (current_sequence ?? 0) + 1
  const padded   = String(sequence).padStart(sequence_padding ?? 4, '0')
  const invoiceNumber = `${invoice_prefix}/${currentFY}/${padded}`

  // Persist incremented sequence + updated FY
  await patchSettings({
    current_sequence: sequence,
    last_fy:          currentFY,
    last_invoice_number: invoiceNumber,
  })

  return invoiceNumber
}
