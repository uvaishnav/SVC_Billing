// Edge Function: generate-invoice-description
// Receives structured invoice context and returns a detailed GST-compliant
// description paragraph (2-4 sentences, ~100-150 words).
// Gemini 2.5 Flash (primary) — system_instruction separated from content.
// Groq Llama 3.3 70B (fallback) on 429/503.
// Requires Authorization: Bearer <jwt> — authenticated users only.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY            = Deno.env.get('GEMINI_API_KEY')!
const GROQ_API_KEY              = Deno.env.get('GROQ_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface LineItemContext {
  description: string
  unit: string | null
  qty: number
  rate: number
}

interface RentalItemContext {
  reg_number:   string
  vehicle_type: string | null
  billing_mode: 'full_month' | 'partial_days'
  num_days:     number | null
  monthly_rent: number
  subtotal:     number
}

interface VehicleContext {
  reg_number: string
  vehicle_type: string | null
  include_in_description: boolean
}

interface DescriptionRequest {
  client_name:   string
  billing_from:  string
  billing_to:    string
  billing_type:  'quantity' | 'rental'
  wo_reference:  string | null
  wo_subject:    string | null
  line_items:    LineItemContext[]
  rental_items:  RentalItemContext[]
  vehicles:      VehicleContext[]
  sac_description:        string | null
  refinement_instruction: string | null
  existing_description:   string | null
}

// ─── System instruction ───────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are an expert billing assistant for an Indian civil engineering and infrastructure services company.
You write the "Description of Services" field that appears on GST tax invoices.

Your descriptions are:
- Specific: mention work order reference, billing period, exact services performed
- Professional: formal language appropriate for a B2B GST invoice submitted to government clients
- Complete: 2 to 4 sentences, approximately 80 to 150 words
- Accurate: only describe what is present in the provided invoice data — never invent details
- GST-aware: you may reference the SAC code category naturally (e.g. "civil construction services", "transportation services")

For RENTAL invoices: describe the vehicle(s) deployed, their rental period, and the billing basis (full month or number of days). Do NOT write rate-per-day figures — describe the service in terms of the rental period and the total charge.

Do NOT include: labels, headers, bullet points, quotes, markdown, or any text other than the description paragraph itself.`

// ─── Content prompt builder ───────────────────────────────────────────────────
function buildContentPrompt(req: DescriptionRequest): string {
  const billingPeriod = `${formatDate(req.billing_from)} to ${formatDate(req.billing_to)}`

  const lines: string[] = [
    `INVOICE DATA:`,
    `Client: ${req.client_name}`,
    `Billing Period: ${billingPeriod}`,
  ]

  if (req.wo_reference)    lines.push(`Work Order No.: ${req.wo_reference}`)
  if (req.wo_subject)      lines.push(`Work Order Subject: ${req.wo_subject}`)
  if (req.sac_description) lines.push(`SAC / Service Category: ${req.sac_description}`)

  if (req.billing_type === 'rental' && req.rental_items.length > 0) {
    // ── Rental mode prompt ──
    lines.push(`Billing Type: Monthly Vehicle Rental`, ``, `Vehicles Billed:`)
    for (const ri of req.rental_items) {
      const label    = ri.vehicle_type ? `${ri.vehicle_type} (${ri.reg_number})` : ri.reg_number
      const period   = ri.billing_mode === 'full_month'
        ? `Full month rental`
        : `${ri.num_days} days out of 30`
      const amount   = `₹${ri.subtotal.toLocaleString('en-IN')}`
      lines.push(`  • ${label} — ${period} — ${amount}`)
    }
  } else {
    // ── Quantity mode prompt ──
    lines.push(`Billing Type: Work Quantity / Services`, ``, `Services / Items Billed:`)
    const itemLines = req.line_items
      .map(i => {
        const qty = i.qty > 0 ? `${i.qty} ${i.unit ?? 'units'}` : `(qty not specified)`
        return `  • ${i.description} — ${qty} @ ₹${i.rate.toLocaleString('en-IN')} per ${i.unit ?? 'unit'}`
      })
      .join('\n')
    lines.push(itemLines)

    const vehiclesForDesc = req.vehicles.filter(v => v.include_in_description)
    if (vehiclesForDesc.length > 0) {
      const vehicleLines = vehiclesForDesc
        .map(v => `${v.vehicle_type ?? 'Vehicle'} (${v.reg_number})`)
        .join(', ')
      lines.push(``, `Vehicles / Equipment Deployed: ${vehicleLines}`)
    }
  }

  lines.push(
    ``,
    `Write the invoice description paragraph for the above. Be specific, professional, and complete (2–4 sentences, 80–150 words).`,
  )

  return lines.join('\n')
}

function buildRefinementPrompt(req: DescriptionRequest): string {
  const lines: string[] = [
    `EXISTING DESCRIPTION:`,
    req.existing_description!,
    ``,
    `USER INSTRUCTION: ${req.refinement_instruction}`,
    ``,
    `INVOICE DATA (for reference):`,
    `Client: ${req.client_name}`,
    `Billing Period: ${formatDate(req.billing_from)} to ${formatDate(req.billing_to)}`,
  ]

  if (req.wo_reference) lines.push(`Work Order No.: ${req.wo_reference}`)
  if (req.wo_subject)   lines.push(`Work Order Subject: ${req.wo_subject}`)

  if (req.billing_type === 'rental' && req.rental_items.length > 0) {
    lines.push(``, `Vehicles Billed:`)
    for (const ri of req.rental_items) {
      const label  = ri.vehicle_type ? `${ri.vehicle_type} (${ri.reg_number})` : ri.reg_number
      const period = ri.billing_mode === 'full_month' ? `Full month` : `${ri.num_days} days`
      lines.push(`  • ${label} — ${period} — ₹${ri.subtotal.toLocaleString('en-IN')}`)
    }
  } else {
    const itemLines = req.line_items
      .map(i => `  • ${i.description} — ${i.qty} ${i.unit ?? 'units'}`)
      .join('\n')
    lines.push(``, `Services Billed:`, itemLines)
  }

  lines.push(
    ``,
    `Rewrite the description applying the user's instruction. Keep it professional, 2–4 sentences, 80–150 words.`,
  )

  return lines.join('\n')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

// ─── Gemini call ──────────────────────────────────────────────────────────────
async function callGemini(contentPrompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ parts: [{ text: contentPrompt }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 600,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (res.status === 429 || res.status === 503) {
    console.log(`Gemini returned ${res.status} — falling back to Groq`)
    return null
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty content')
  return text.trim()
}

// ─── Groq fallback ────────────────────────────────────────────────────────────
async function callGroq(contentPrompt: string): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions'

  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user',   content: contentPrompt },
    ],
    temperature: 0.5,
    max_tokens: 600,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq returned empty content')
  return content.trim()
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const jwt = authHeader.replace('Bearer ', '')
  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser(jwt)
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized — invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  let reqBody: DescriptionRequest
  try {
    reqBody = await req.json()

    if (!reqBody.client_name || !reqBody.billing_from || !reqBody.billing_to) {
      return new Response(
        JSON.stringify({ error: 'client_name, billing_from, and billing_to are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Validate that the request has at least some billable content
    const isRental   = reqBody.billing_type === 'rental'
    const hasItems   = Array.isArray(reqBody.line_items)   && reqBody.line_items.length   > 0
    const hasRentals = Array.isArray(reqBody.rental_items) && reqBody.rental_items.length > 0

    if (!hasItems && !hasRentals) {
      return new Response(
        JSON.stringify({ error: 'At least one line item or rental item is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (isRental && !hasRentals) {
      return new Response(
        JSON.stringify({ error: 'Rental invoice must include at least one rental item with a vehicle selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (!isRental && !hasItems) {
      return new Response(
        JSON.stringify({ error: 'Quantity invoice must include at least one line item' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Default empty arrays if not provided (safe fallback)
    reqBody.line_items   = reqBody.line_items   ?? []
    reqBody.rental_items = reqBody.rental_items ?? []
    reqBody.vehicles     = reqBody.vehicles     ?? []

  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const isRefinement = !!(reqBody.refinement_instruction && reqBody.existing_description)
    const contentPrompt = isRefinement
      ? buildRefinementPrompt(reqBody)
      : buildContentPrompt(reqBody)

    let description = await callGemini(contentPrompt)
    let provider = 'gemini'

    if (description === null) {
      description = await callGroq(contentPrompt)
      provider = 'groq'
    }

    return new Response(
      JSON.stringify({ description, provider }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('generate-invoice-description error:', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
