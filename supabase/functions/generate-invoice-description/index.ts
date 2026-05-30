// Edge Function: generate-invoice-description
// Receives structured invoice context and returns a concise GST invoice description
// strictly under 350 characters.
//
// Design decisions (2026-05-30 redesign):
//   - client_name removed from inputs — it appears on the invoice header, not in the description
//   - rates, quantities, amounts removed — already in the bill table
//   - sac_description sent as internal context only — AI must NOT mention SAC code or nickname
//   - quantity mode: sends work item descriptions + vehicles marked for inclusion
//   - rental mode: sends vehicle deployment info (no money fields)
//   - separate system prompts per billing type for sharper output
//   - maxOutputTokens raised to 800 to prevent cutoffs
//   - temperature lowered to 0.3 for consistency on a legal document
//
// Gemini 2.5 Flash (primary) — Groq Llama 3.3 70B (fallback) on 429/503.
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
interface VehicleContext {
  reg_number:   string
  vehicle_type: string | null
}

interface RentalItemContext {
  reg_number:   string
  vehicle_type: string | null
  billing_mode: 'full_month' | 'partial_days'
  num_days:     number | null
  // NOTE: monthly_rent and subtotal intentionally excluded — already in the bill
}

interface DescriptionRequest {
  billing_from:  string
  billing_to:    string
  billing_type:  'quantity' | 'rental'
  wo_reference:  string | null
  wo_subject:    string | null
  // Internal context only — AI must NOT mention SAC code or its nickname in output
  sac_description:        string | null
  // Quantity mode
  work_item_descriptions: string[]
  vehicles:               VehicleContext[]
  // Rental mode
  rental_items:           RentalItemContext[]
  // Refinement
  refinement_instruction: string | null
  existing_description:   string | null
}

// ─── System instructions — one per billing type ───────────────────────────────

const SYSTEM_INSTRUCTION_QUANTITY = `You are a billing assistant for an Indian infrastructure and civil engineering services company.
Your task is to write the "Description of Services" field for a GST tax invoice.

Rules — follow every one without exception:
1. Output a single grammatically correct, professional English paragraph.
2. The paragraph must be STRICTLY UNDER 350 characters including spaces. This is a hard limit.
3. Summarise what work was performed and in which billing period.
4. Always mention the vehicles/equipment if they are provided — do not omit them.
5. Do NOT mention: the client name, rates, quantities, amounts, SAC codes, or SAC nicknames.
6. Do NOT include labels, headers, bullet points, quotes, or markdown — plain paragraph only.
7. Do NOT invent any detail not present in the invoice data provided.
8. The service category is given as internal context only — use it to understand the nature of work but never quote it directly.`

const SYSTEM_INSTRUCTION_RENTAL = `You are a billing assistant for an Indian infrastructure and civil engineering services company.
Your task is to write the "Description of Services" field for a GST tax invoice.

Rules — follow every one without exception:
1. Output a single grammatically correct, professional English paragraph.
2. The paragraph must be STRICTLY UNDER 350 characters including spaces. This is a hard limit.
3. Describe which vehicles were deployed, what work they supported (from the work order subject), and the billing period (from date to date).
4. If a vehicle was on partial days, mention it naturally (e.g. "deployed for X days during the period").
5. Do NOT mention: the client name, rental rates, amounts, SAC codes, or SAC nicknames.
6. Do NOT include labels, headers, bullet points, quotes, or markdown — plain paragraph only.
7. Do NOT invent any detail not present in the invoice data provided.
8. The service category is given as internal context only — use it to understand the nature of work but never quote it directly.`

const SYSTEM_INSTRUCTION_REFINE = `You are a billing assistant for an Indian infrastructure and civil engineering services company.
Your task is to edit an existing "Description of Services" paragraph from a GST tax invoice based on a user instruction.

Rules — follow every one without exception:
1. Apply the user's instruction faithfully (e.g. remove vehicles, shorten, change tense).
2. Output a single grammatically correct, professional English paragraph.
3. The paragraph must be STRICTLY UNDER 350 characters including spaces. This is a hard limit.
4. Do NOT mention: the client name, rates, quantities, amounts, SAC codes, or SAC nicknames.
5. Do NOT include labels, headers, bullet points, quotes, or markdown — plain paragraph only.
6. Do NOT invent any detail not already present in the existing description or the invoice data.`

// ─── Content prompt builders ──────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    // Use UTC to avoid timezone shift (date-only strings are UTC midnight)
    const [y, m, d] = iso.split('-').map(Number)
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December']
    return `${String(d).padStart(2,'0')} ${months[m-1]} ${y}`
  } catch { return iso }
}

function buildGeneratePrompt(req: DescriptionRequest): string {
  const from = formatDate(req.billing_from)
  const to   = formatDate(req.billing_to)
  const lines: string[] = [
    `INVOICE DATA:`,
    `Billing Period: ${from} to ${to}`,
  ]

  if (req.wo_reference) lines.push(`Work Order Ref: ${req.wo_reference}`)
  if (req.wo_subject)   lines.push(`Work Order Subject: ${req.wo_subject}`)
  if (req.sac_description) {
    lines.push(`Service Category (internal context only — do NOT mention this in output): ${req.sac_description}`)
  }

  if (req.billing_type === 'rental') {
    // ── Rental prompt ──
    lines.push(``, `Vehicles on Rental:`)
    for (const ri of req.rental_items) {
      const label  = ri.vehicle_type ? `${ri.vehicle_type} (${ri.reg_number})` : ri.reg_number
      const period = ri.billing_mode === 'full_month'
        ? `full month`
        : `${ri.num_days} days`
      lines.push(`  • ${label} — ${period}`)
    }
  } else {
    // ── Quantity prompt ──
    if (req.work_item_descriptions.length > 0) {
      lines.push(``, `Work Items Billed:`)
      for (const desc of req.work_item_descriptions) {
        lines.push(`  • ${desc}`)
      }
    }
    if (req.vehicles.length > 0) {
      const vehicleList = req.vehicles
        .map(v => v.vehicle_type ? `${v.vehicle_type} (${v.reg_number})` : v.reg_number)
        .join(', ')
      lines.push(``, `Vehicles/Equipment Deployed (must be mentioned): ${vehicleList}`)
    }
  }

  lines.push(
    ``,
    `Write the description paragraph now. Remember: strictly under 350 characters, no client name, no amounts, no SAC codes.`,
  )

  return lines.join('\n')
}

function buildRefinementPrompt(req: DescriptionRequest): string {
  const from = formatDate(req.billing_from)
  const to   = formatDate(req.billing_to)

  const lines: string[] = [
    `EXISTING DESCRIPTION:`,
    req.existing_description!,
    ``,
    `USER INSTRUCTION: ${req.refinement_instruction}`,
    ``,
    `INVOICE DATA (for reference):`,
    `Billing Period: ${from} to ${to}`,
  ]

  if (req.wo_reference) lines.push(`Work Order Ref: ${req.wo_reference}`)
  if (req.wo_subject)   lines.push(`Work Order Subject: ${req.wo_subject}`)

  if (req.billing_type === 'rental' && req.rental_items.length > 0) {
    lines.push(``, `Vehicles on Rental:`)
    for (const ri of req.rental_items) {
      const label  = ri.vehicle_type ? `${ri.vehicle_type} (${ri.reg_number})` : ri.reg_number
      const period = ri.billing_mode === 'full_month' ? `full month` : `${ri.num_days} days`
      lines.push(`  • ${label} — ${period}`)
    }
  } else if (req.work_item_descriptions.length > 0) {
    lines.push(``, `Work Items Billed:`)
    for (const desc of req.work_item_descriptions) {
      lines.push(`  • ${desc}`)
    }
    if (req.vehicles.length > 0) {
      const vehicleList = req.vehicles
        .map(v => v.vehicle_type ? `${v.vehicle_type} (${v.reg_number})` : v.reg_number)
        .join(', ')
      lines.push(`Vehicles/Equipment: ${vehicleList}`)
    }
  }

  lines.push(
    ``,
    `Rewrite the description applying the user's instruction. Strictly under 350 characters, no client name, no amounts, no SAC codes.`,
  )

  return lines.join('\n')
}

// ─── Gemini call ──────────────────────────────────────────────────────────────
async function callGemini(systemInstruction: string, contentPrompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: contentPrompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 800,
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
async function callGroq(systemInstruction: string, contentPrompt: string): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions'

  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user',   content: contentPrompt },
    ],
    temperature: 0.3,
    max_tokens: 800,
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

    if (!reqBody.billing_from || !reqBody.billing_to) {
      return new Response(
        JSON.stringify({ error: 'billing_from and billing_to are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Default empty arrays
    reqBody.work_item_descriptions = reqBody.work_item_descriptions ?? []
    reqBody.vehicles               = reqBody.vehicles               ?? []
    reqBody.rental_items           = reqBody.rental_items           ?? []

    const isRental   = reqBody.billing_type === 'rental'
    const hasItems   = reqBody.work_item_descriptions.length > 0
    const hasRentals = reqBody.rental_items.length > 0

    const isRefinement = !!(reqBody.refinement_instruction && reqBody.existing_description)

    // For non-refinement calls: validate there's enough content to generate from
    if (!isRefinement) {
      if (isRental && !hasRentals) {
        return new Response(
          JSON.stringify({ error: 'Rental invoice must include at least one rental item with a vehicle selected' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      if (!isRental && !hasItems) {
        return new Response(
          JSON.stringify({ error: 'Quantity invoice must include at least one work item' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const isRefinement = !!(reqBody.refinement_instruction && reqBody.existing_description)

    // Pick the right system instruction
    let systemInstruction: string
    if (isRefinement) {
      systemInstruction = SYSTEM_INSTRUCTION_REFINE
    } else if (reqBody.billing_type === 'rental') {
      systemInstruction = SYSTEM_INSTRUCTION_RENTAL
    } else {
      systemInstruction = SYSTEM_INSTRUCTION_QUANTITY
    }

    const contentPrompt = isRefinement
      ? buildRefinementPrompt(reqBody)
      : buildGeneratePrompt(reqBody)

    let description = await callGemini(systemInstruction, contentPrompt)
    let provider = 'gemini'

    if (description === null) {
      description = await callGroq(systemInstruction, contentPrompt)
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
