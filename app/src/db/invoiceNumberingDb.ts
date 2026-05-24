// invoiceNumberingDb.ts
// Frontend helper to call the generate-invoice-number Edge Function.
// Returns the formatted invoice number string e.g. "SVC/25-26/001".
// Throws a descriptive error on failure — caller should handle and show toast.

import { supabase } from './supabaseClient'

export async function generateInvoiceNumber(): Promise<string> {
  // Get the current session JWT
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) {
    throw new Error('Not authenticated. Please log in again.')
  }

  const jwt = sessionData.session.access_token
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

  const response = await fetch(
    `${supabaseUrl}/functions/v1/generate-invoice-number`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const body = await response.json()

  if (!response.ok || !body.invoice_number) {
    throw new Error(body.error ?? 'Failed to generate invoice number')
  }

  return body.invoice_number as string
}
