// Edge Function: parse-work-order
// Receives OCR-extracted text from a work order PDF.
// Calls Gemini 2.5 Flash with a strict JSON schema to extract structured fields.
// Falls back to Groq (Llama 3.3 70B) if Gemini returns 429.
// Requires Authorization: Bearer <jwt> header — authenticated users only.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL               = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY             = Deno.env.get('GEMINI_API_KEY')!
const GROQ_API_KEY               = Deno.env.get('GROQ_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// The JSON schema we want the AI to fill
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    wo_reference:     { type: 'string',  description: 'Work order reference number e.g. LC-14, WO-2024/001' },
    issue_date:       { type: 'string',  description: 'Issue date in YYYY-MM-DD format' },
    subject:          { type: 'string',  description: 'Full subject / description of work' },
    duration_months:  { type: 'number',  description: 'Duration of the work order in months (integer)' },
    total_value:      { type: 'number',  description: 'Total contract value in INR (number only, no commas or symbols)' },
    rates_firm:       { type: 'boolean', description: 'True if rates are firm with no escalation clause' },
    tds_applicable:   { type: 'boolean', description: 'True if TDS deduction is mentioned as applicable' },
    billing_type:     { type: 'string',  enum: ['monthly_ra', 'milestone', 'adhoc'], description: 'Billing type based on WO content' },
    items: {
      type: 'array',
      description: 'Line items from the work order schedule of quantities/rates table',
      items: {
        type: 'object',
        properties: {
          description:    { type: 'string' },
          sub_work_ref:   { type: 'string', description: 'Sub-work reference e.g. SW:1, SW-A' },
          unit:           { type: 'string', description: 'Unit of measurement e.g. MT, CUM, Month, LS' },
          contracted_qty: { type: 'number' },
          rate:           { type: 'number', description: 'Rate per unit in INR' },
        },
        required: ['description', 'rate'],
      },
    },
  },
  required: ['subject'],
}

const SYSTEM_PROMPT = `You are a precise data extraction assistant for an Indian GST billing application.
Extract structured fields from work order text. Follow these rules strictly:
- Dates must be in YYYY-MM-DD format
- All monetary values are in INR — extract as plain numbers (no commas, no ₹ symbol)
- If a field is not found in the text, omit it (do not guess)
- duration_months: convert years to months if needed (e.g. 15 months, or 1 year 3 months = 15)
- billing_type: use 'monthly_ra' for RA bills / running account bills, 'milestone' for stage payments, 'adhoc' otherwise
- rates_firm: true if text says "rates are firm" or "no escalation"
- Extract ALL line items from the schedule of quantities / rate schedule table
- For items, extract sub_work_ref if present (e.g. SW:1, SW:2)
`

async function callGemini(ocrText: string): Promise<object | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: `Extract structured data from this work order text:\n\n${ocrText}` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (res.status === 429) return null  // Signal fallback needed

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty content')
  return JSON.parse(text)
}

async function callGroq(ocrText: string): Promise<object> {
  const url = 'https://api.groq.com/openai/v1/chat/completions'

  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: `Extract structured data from this work order text and return valid JSON matching this schema: ${JSON.stringify(RESPONSE_SCHEMA)}\n\nWork order text:\n\n${ocrText}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
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
  return JSON.parse(content)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth check — same pattern as generate-invoice-number
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

  // Parse request body
  let ocrText: string
  try {
    const body = await req.json()
    ocrText = body?.ocr_text
    if (!ocrText || typeof ocrText !== 'string' || ocrText.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: 'ocr_text is required and must be at least 20 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    // Try Gemini 2.5 Flash first
    let parsed = await callGemini(ocrText)
    let provider = 'gemini'

    // Fallback to Groq if Gemini rate-limited
    if (parsed === null) {
      console.log('Gemini rate limited — falling back to Groq')
      parsed = await callGroq(ocrText)
      provider = 'groq'
    }

    return new Response(
      JSON.stringify({ parsed, provider }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('parse-work-order error:', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
