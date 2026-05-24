// Edge Function: generate-invoice-number
// Calls the atomic get_next_invoice_number() Postgres RPC.
// Requires Authorization: Bearer <jwt> header — authenticated users only.
// Implements exponential backoff retry (max 4 attempts) for lock timeout resilience.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verify Authorization header — authenticated users only
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const jwt = authHeader.replace('Bearer ', '')

  // Create a user-scoped client to verify the JWT is valid
  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  })

  // Verify the token by fetching the user
  const { data: { user }, error: authError } = await userClient.auth.getUser(jwt)
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized — invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Exponential backoff retry: attempts at 0ms, 100ms, 200ms, 400ms
  const MAX_ATTEMPTS = 4
  const BASE_DELAY_MS = 100
  let lastError: string = 'Unknown error'

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1))
    }

    const { data, error } = await userClient.rpc('get_next_invoice_number')

    if (!error && data) {
      return new Response(
        JSON.stringify({ invoice_number: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    lastError = error?.message ?? 'RPC returned no data'
    console.error(`Attempt ${attempt + 1} failed: ${lastError}`)
  }

  // All attempts exhausted
  return new Response(
    JSON.stringify({ error: `Failed after ${MAX_ATTEMPTS} attempts: ${lastError}` }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
