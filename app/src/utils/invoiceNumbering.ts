// Calls the generate-invoice-number Edge Function.
// The Edge Function calls the atomic get_next_invoice_number() Postgres RPC
// with exponential backoff — safe for concurrent use.
import { supabase } from '../db/supabaseClient'

export async function generateInvoiceNumber(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice-number`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    }
  )

  if (!res.ok) return null
  const data = await res.json()
  return data.invoice_number ?? null
}
