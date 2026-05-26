// Edge Function: generate-invoice-description
// Receives structured invoice context and generates a crisp GST-compliant
// overall description paragraph.
// Supports initial generation and AI-guided refinement.
// Uses Gemini 2.5 Flash primary, Groq Llama 3.3 70B fallback (429 + 503).
// Requires Authorization: Bearer <jwt> header.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY            = Deno.env.get('GEMINI_API_KEY')!
const GROQ_API_KEY              = Deno.env.get('GROQ_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvoiceContext {
  client_name: string
  billing_from: string           // YYYY-MM-DD
  billing_to: string             // YYYY-MM-DD
  wo_reference?: string
  wo_subject?: string
  line_items: { description: string; qty: number; unit: string | null }[]
  vehicles: { reg_number: string; vehicle_type: string | null; include_in_description: boolean }[]
  sac_description?: string
  // For refinement mode
  existing_description?: string
  refinement_instruction?: string
}

function buildPrompt(ctx: InvoiceContext): string {
  const vehicles = ctx.vehicles.filter(v => v.include_in_description)
  const vehicleText = vehicles.length > 0
    ? `Vehicles deployed: ${vehicles.map(v => `${v.vehicle_type ?? ''} (${v.reg_number})`).join(', ')}.`
    : ''

  const itemText = ctx.line_items
    .map(i => `${i.description}${i.unit ? ` (${i.qty} ${i.unit})` : ''}`)
    .join('; ')

  const woText = ctx.wo_reference ? `under Work Order Ref. ${ctx.wo_reference}` : ''

  const baseContext = [
    `Client: ${ctx.client_name}`,
    `Billing period: ${ctx.billing_from} to ${ctx.billing_to}`,
    ctx.wo_subject ? `Work order subject: ${ctx.wo_subject}` : '',
    `Work items: ${itemText}`,
    vehicleText,
    woText,
  ].filter(Boolean).join('\n')

  if (ctx.existing_description && ctx.refinement_instruction) {
    return `You are editing a GST invoice description.\n\nCurrent description:\n"${ctx.existing_description}"\n\nUser instruction: ${ctx.refinement_instruction}\n\nRewrite the description following the instruction. Keep it 1-3 sentences, professional, GST-compliant. Return only the description text, no quotes.`
  }

  return `You are generating an overall description for an Indian GST tax invoice for a construction equipment rental business.\n\nInvoice context:\n${baseContext}\n\nWrite a crisp 1-3 sentence description of the service rendered. It must:\n- Be professional and formal\n- Mention the nature of work, client, and billing period\n- Include vehicle details if provided\n- Be under 300 characters\n- Not include invoice number, amounts, or tax details\n- Return only the description text, no quotes or extra formatting`
}

async function callGemini(prompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
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
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
}

async function callGroq(prompt: string): Promise<string> {
  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are a professional invoice description writer for Indian GST invoices.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 200,
  }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() ?? ''
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const jwt = authHeader.replace('Bearer ', '')
  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser(jwt)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let ctx: InvoiceContext
  try {
    ctx = await req.json()
    if (!ctx.client_name || !ctx.billing_from || !ctx.billing_to || !ctx.line_items?.length) {
      return new Response(JSON.stringify({ error: 'Missing required fields: client_name, billing_from, billing_to, line_items' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const prompt = buildPrompt(ctx)
    let description = await callGemini(prompt)
    let provider = 'gemini'
    if (description === null) {
      description = await callGroq(prompt)
      provider = 'groq'
    }
    return new Response(JSON.stringify({ description, provider }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('generate-invoice-description error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
