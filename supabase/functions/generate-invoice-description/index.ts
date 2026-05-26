// Edge Function: generate-invoice-description
// Receives structured invoice context and returns a crisp GST-compliant
// overall description paragraph (1–3 sentences).
// Supports Gemini 2.5 Flash (primary) with Groq Llama 3.3 70B fallback
// on 429 (rate limit) or 503 (model overloaded) — same pattern as parse-work-order.
// Requires Authorization: Bearer <jwt> header — authenticated users only.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY            = Deno.env.get('GEMINI_API_KEY')!
const GROQ_API_KEY              = Deno.env.get('GROQ_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types (mirrors InvoiceDraft context sent from frontend) ─────────────────
interface LineItemContext {
  description: string
  unit: string | null
  qty: number
  rate: number
}

interface VehicleContext {
  reg_number: string
  vehicle_type: string | null
  include_in_description: boolean
}

interface DescriptionRequest {
  // Core invoice context
  client_name: string
  billing_from: string          // YYYY-MM-DD
  billing_to: string            // YYYY-MM-DD
  wo_reference: string | null
  wo_subject: string | null
  line_items: LineItemContext[]
  vehicles: VehicleContext[]
  sac_description: string | null

  // Optional: user refinement instruction
  // If provided, existing_description must also be provided
  refinement_instruction: string | null
  existing_description: string | null
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(req: DescriptionRequest): string {
  const billingPeriod = `${formatDate(req.billing_from)} to ${formatDate(req.billing_to)}`

  const itemLines = req.line_items
    .map(i => `- ${i.description} (${i.qty} ${i.unit ?? 'units'} @ ₹${i.rate}/${i.unit ?? 'unit'})`)
    .join('\n')

  const vehiclesForDesc = req.vehicles.filter(v => v.include_in_description)
  const vehicleLines = vehiclesForDesc.length > 0
    ? vehiclesForDesc.map(v => `${v.vehicle_type ?? 'Vehicle'} (${v.reg_number})`).join(', ')
    : null

  const parts: string[] = []
  parts.push(`Client: ${req.client_name}`)
  parts.push(`Billing Period: ${billingPeriod}`)
  if (req.wo_reference) parts.push(`Work Order Reference: ${req.wo_reference}`)
  if (req.wo_subject)   parts.push(`Work Order Subject: ${req.wo_subject}`)
  if (req.sac_description) parts.push(`Service Type: ${req.sac_description}`)
  parts.push(`Line Items Billed:\n${itemLines}`)
  if (vehicleLines)     parts.push(`Vehicles Deployed: ${vehicleLines}`)

  if (req.refinement_instruction && req.existing_description) {
    return [
      `You are refining an existing invoice description based on user instructions.`,
      ``,
      `Existing description:`,
      `"${req.existing_description}"`,
      ``,
      `User instruction: ${req.refinement_instruction}`,
      ``,
      `Invoice context for reference:`,
      ...parts,
      ``,
      `Rules:`,
      `- Return ONLY the revised description text (1–3 sentences, max 300 characters)`,
      `- Formal, professional tone suitable for a GST tax invoice`,
      `- Do not include labels, quotes, or any extra text`,
      `- Must truthfully describe the service rendered`,
    ].join('\n')
  }

  return [
    `You are generating a concise overall description for an Indian GST tax invoice.`,
    ``,
    `Invoice context:`,
    ...parts,
    ``,
    `Rules:`,
    `- Return ONLY the description text (1–3 sentences, max 300 characters)`,
    `- Formal, professional tone suitable for a GST tax invoice`,
    `- Do not include labels, headers, quotes, or any extra text`,
    `- Describe the nature of service, time period, and key context`,
    `- If vehicles are provided, mention them naturally (e.g. "deployed 1 excavator and 2 JCBs")`,
    `- Must truthfully describe the service rendered based on the context above`,
  ].join('\n')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

// ─── Gemini call ──────────────────────────────────────────────────────────────
async function callGemini(prompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
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
async function callGroq(prompt: string): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions'

  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 200,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
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

  // Auth check — same pattern as parse-work-order
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

  // Parse body
  let reqBody: DescriptionRequest
  try {
    reqBody = await req.json()
    if (!reqBody.client_name || !reqBody.billing_from || !reqBody.billing_to) {
      return new Response(
        JSON.stringify({ error: 'client_name, billing_from, and billing_to are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (!Array.isArray(reqBody.line_items) || reqBody.line_items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one line item is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Generate description
  try {
    const prompt = buildPrompt(reqBody)

    let description = await callGemini(prompt)
    let provider = 'gemini'

    if (description === null) {
      description = await callGroq(prompt)
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
