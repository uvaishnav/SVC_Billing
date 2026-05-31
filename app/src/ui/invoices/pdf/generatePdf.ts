/**
 * generatePdf.ts
 *
 * GST-compliant invoice PDF generator using jsPDF (CDN build loaded dynamically).
 * Supports two completely separate layout paths:
 *   - 'quantity'  → multi-row line items table (Sl. No / Description / SAC / Unit / Qty / Rate / Amount)
 *   - 'rental'    → vehicle rental table (Vehicle / Reg No / Period / Mode / Days / Monthly Rent / Amount)
 *
 * Layout sections (from design-decisions.md, 2026-05-26):
 *   1. Header band       — supplier identity (name, address, GSTIN, PAN, phone/email, logo)
 *   2. Invoice metadata  — invoice number, date, billing period, W.O. reference (muted)
 *   3. Bill-to block     — client name, address, GSTIN, place of supply, tax mode, reverse charge
 *   4. Line items table  — billing-type-specific columns
 *   5. Totals block      — taxable, GST split, total (bold), TDS line, net receivable
 *   6. Amount in words
 *   7. Bank details      — bank name, A/C name, A/C number, IFSC, branch
 *   8. Declaration + authorized signatory name + signature line
 */

import type { InvoiceDraft } from '../../../db/types'
import type { Settings, BankAccount, SacCode } from '../../../db/types'
import { supabase } from '../../../db/supabaseClient'

// ─── jsPDF lazy loader ────────────────────────────────────────────────────────

declare global {
  interface Window {
    jspdf?: { jsPDF: new (opts?: object) => JsPDFInstance }
  }
}

interface JsPDFInstance {
  internal: { pageSize: { getWidth(): number; getHeight(): number } }
  setFont(name: string, style?: string): void
  setFontSize(size: number): void
  setTextColor(r: number, g?: number, b?: number): void
  setDrawColor(r: number, g?: number, b?: number): void
  setFillColor(r: number, g?: number, b?: number): void
  setLineWidth(w: number): void
  text(text: string | string[], x: number, y: number, opts?: object): void
  line(x1: number, y1: number, x2: number, y2: number): void
  rect(x: number, y: number, w: number, h: number, style?: string): void
  addImage(data: string, fmt: string, x: number, y: number, w: number, h: number): void
  addPage(): void
  output(type: 'blob'): Blob
  splitTextToSize(text: string, maxWidth: number): string[]
  getTextWidth(text: string): number
}

async function loadJsPDF(): Promise<new (opts?: object) => JsPDFInstance> {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load jsPDF'))
    document.head.appendChild(s)
  })
  if (!window.jspdf?.jsPDF) throw new Error('jsPDF not available after script load')
  return window.jspdf.jsPDF
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (error || !data) throw new Error('Could not load business settings for PDF')
  return data as Settings
}

async function fetchBankAccount(id: number): Promise<BankAccount | null> {
  const { data } = await supabase.from('bank_accounts').select('*').eq('id', id).single()
  return data as BankAccount | null
}

async function fetchSacCode(id: number): Promise<SacCode | null> {
  const { data } = await supabase.from('sac_codes').select('*').eq('id', id).single()
  return data as SacCode | null
}

async function fetchClientGstin(id: number) {
  const { data } = await supabase
    .from('client_gstins')
    .select('gstin, state, state_code, address, clients(name)')
    .eq('id', id)
    .single()
  return data as { gstin: string; state: string; state_code: string; address: string; clients: { name: string } | null } | null
}

async function fetchWorkOrderRef(id: number): Promise<string | null> {
  const { data } = await supabase.from('work_orders').select('wo_reference').eq('id', id).single()
  return (data as { wo_reference: string | null } | null)?.wo_reference ?? null
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    return await new Promise((res) => {
      const reader = new FileReader()
      reader.onload = () => res(reader.result as string)
      reader.onerror = () => res(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const M = 14          // page margin
const PW = 210        // A4 width mm
const CW = PW - M * 2 // content width (182mm)

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generatePdf(draft: InvoiceDraft): Promise<Blob> {
  const [JsPDF, settings, clientGstin, bank, sac] = await Promise.all([
    loadJsPDF(),
    fetchSettings(),
    draft.client_gstin_id ? fetchClientGstin(draft.client_gstin_id) : Promise.resolve(null),
    draft.bank_account_id ? fetchBankAccount(draft.bank_account_id) : Promise.resolve(null),
    draft.sac_id ? fetchSacCode(draft.sac_id) : Promise.resolve(null),
  ])

  const woRef = draft.work_order_id ? await fetchWorkOrderRef(draft.work_order_id) : null
  const logoDataUrl = settings.logo_url ? await loadImageAsDataUrl(settings.logo_url) : null

  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as JsPDFInstance

  let y = M // current vertical cursor

  // ─── 1. Header band ───────────────────────────────────────────────────────

  // Background tint
  doc.setFillColor(248, 247, 242)
  doc.rect(M, y, CW, 36, 'F')

  // Logo (top-right corner of header)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', PW - M - 28, y + 2, 26, 20)
    } catch { /* skip if logo format fails */ }
  }

  // Business name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(30, 25, 15)
  doc.text(settings.business_name.toUpperCase(), M + 3, y + 8)

  // Address, GSTIN, PAN, phone, email
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80, 76, 70)
  const supplierLines = [
    settings.address,
    `GSTIN: ${settings.gstin}${settings.pan ? `  |  PAN: ${settings.pan}` : ''}`,
    [settings.phone, settings.email].filter(Boolean).join('  |  '),
  ].filter(Boolean)
  supplierLines.forEach((line, i) => {
    doc.text(line, M + 3, y + 14 + i * 5)
  })

  y += 38

  // ─── Divider ──────────────────────────────────────────────────────────────
  doc.setDrawColor(180, 170, 158)
  doc.setLineWidth(0.3)
  doc.line(M, y, M + CW, y)
  y += 4

  // ─── "TAX INVOICE" title + invoice number ─────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 25, 15)
  doc.text('TAX INVOICE', M + CW / 2, y + 5, { align: 'center' })

  y += 10

  // ─── 2. Invoice metadata (two-column) ─────────────────────────────────────
  doc.setFontSize(8.5)
  const col2x = M + CW / 2 + 5

  const metaLeft = [
    ['Invoice No.', draft.invoice_number],
    ['Invoice Date', fmtDate(draft.invoice_date)],
    ['Billing Period', `${fmtDate(draft.billing_from)} to ${fmtDate(draft.billing_to)}`],
  ]
  if (woRef) metaLeft.push(['W.O. Ref.', woRef])

  const taxLabel = draft.tax_mode === 'igst' ? 'Tax Mode' : 'Tax Mode'
  const taxValue = draft.tax_mode === 'igst' ? 'IGST' : 'CGST + SGST'
  const metaRight = [
    [taxLabel, taxValue],
    ['Place of Supply', `${draft.place_of_supply} (${draft.place_of_supply_code})`],
    ['Reverse Charge', draft.reverse_charge ? 'Yes' : 'No'],
  ]
  if (sac) metaRight.push(['SAC Code', sac.sac_code])

  const metaRows = Math.max(metaLeft.length, metaRight.length)
  metaLeft.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 76, 70)
    doc.text(label + ':', M, y + i * 5.5)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 25, 15)
    doc.text(value, M + 28, y + i * 5.5)
  })
  metaRight.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 76, 70)
    doc.text(label + ':', col2x, y + i * 5.5)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 25, 15)
    doc.text(value, col2x + 28, y + i * 5.5)
  })

  y += metaRows * 5.5 + 4

  // ─── Divider ──────────────────────────────────────────────────────────────
  doc.setDrawColor(180, 170, 158)
  doc.line(M, y, M + CW, y)
  y += 4

  // ─── 3. Bill-to block ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(80, 76, 70)
  doc.text('BILL TO', M, y + 4)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(30, 25, 15)
  const clientName = clientGstin?.clients?.name ?? 'N/A'
  doc.text(clientName.toUpperCase(), M, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(60, 56, 50)
  if (clientGstin) {
    const addrLines = doc.splitTextToSize(clientGstin.address, CW * 0.55)
    addrLines.forEach((line: string) => { doc.text(line, M, y); y += 4.5 })
    doc.text(`GSTIN: ${clientGstin.gstin}`, M, y); y += 4.5
    doc.text(`State: ${clientGstin.state} (${clientGstin.state_code})`, M, y); y += 5
  }

  y += 2

  // ─── Divider ──────────────────────────────────────────────────────────────
  doc.setDrawColor(180, 170, 158)
  doc.line(M, y, M + CW, y)
  y += 5

  // ─── 4. Line items table ──────────────────────────────────────────────────

  if (draft.line_item_billing_type === 'quantity') {
    y = drawQuantityTable(doc, draft, y, sac)
  } else {
    y = drawRentalTable(doc, draft, y)
  }

  y += 5

  // ─── 5. Totals block ──────────────────────────────────────────────────────
  y = drawTotals(doc, draft, y)

  y += 4

  // ─── 6. Amount in words ───────────────────────────────────────────────────
  if (draft.amount_in_words) {
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 25, 15)
    doc.text('Amount in Words:', M, y)
    doc.setFont('helvetica', 'normal')
    const wordsLines = doc.splitTextToSize(draft.amount_in_words, CW - 38)
    wordsLines.forEach((line: string, i: number) => {
      doc.text(line, M + 36, y + i * 4.5)
    })
    y += wordsLines.length * 4.5 + 4
  }

  // ─── Divider ──────────────────────────────────────────────────────────────
  doc.setDrawColor(180, 170, 158)
  doc.line(M, y, M + CW, y)
  y += 5

  // ─── 7. Bank details ──────────────────────────────────────────────────────
  if (bank) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(80, 76, 70)
    doc.text('BANK DETAILS', M, y)
    y += 5

    const bankFields: [string, string][] = [
      ['Bank Name', bank.bank_name],
      ['Account Name', bank.account_name],
      ['Account Number', bank.account_number],
      ['IFSC Code', bank.ifsc],
    ]
    if (bank.branch) bankFields.push(['Branch', bank.branch])

    bankFields.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 76, 70)
      doc.text(label + ':', M, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 25, 15)
      doc.text(value, M + 30, y)
      y += 4.8
    })
    y += 3
  }

  // ─── Divider ──────────────────────────────────────────────────────────────
  doc.setDrawColor(180, 170, 158)
  doc.line(M, y, M + CW, y)
  y += 5

  // ─── 8. Declaration + signatory ───────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 96, 90)
  const declaration =
    'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.'
  const declLines = doc.splitTextToSize(declaration, CW * 0.58)
  declLines.forEach((line: string, i: number) => { doc.text(line, M, y + i * 4) })

  // Right side: For <business_name> + signatory
  const sigX = M + CW * 0.62
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(30, 25, 15)
  doc.text(`For ${settings.business_name}`, sigX, y)
  y += 14
  doc.setDrawColor(120, 116, 110)
  doc.line(sigX, y, sigX + 60, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(60, 56, 50)
  doc.text(settings.authorized_signatory, sigX, y)
  doc.text('Authorized Signatory', sigX, y + 4)

  return doc.output('blob')
}

// ─── Quantity table ───────────────────────────────────────────────────────────

function drawQuantityTable(
  doc: JsPDFInstance,
  draft: InvoiceDraft,
  startY: number,
  sac: SacCode | null,
): number {
  const cols = [
    { label: 'Sl.\nNo.', width: 9, align: 'center' as const },
    { label: 'Description of\nGoods / Services', width: 64, align: 'left' as const },
    { label: 'SAC', width: 14, align: 'center' as const },
    { label: 'Unit', width: 12, align: 'center' as const },
    { label: 'Qty', width: 12, align: 'center' as const },
    { label: 'Rate (₹)', width: 22, align: 'right' as const },
    { label: 'Taxable\nValue (₹)', width: 29, align: 'right' as const },
  ]

  let y = startY
  y = drawTableHeader(doc, cols, y)

  draft.line_items.forEach((item) => {
    const sacStr = sac?.sac_code ?? (item.sac_id ? String(item.sac_id) : '')
    const rowValues = [
      String(item.sl_no),
      item.description,
      sacStr,
      item.unit ?? '',
      fmt(item.qty),
      fmt(item.rate),
      fmt(item.taxable_value),
    ]
    y = drawTableRow(doc, cols, rowValues, y)
  })

  // Footer total row
  y = drawTableFooterRow(doc, cols, ['', '', '', '', '', 'Total Taxable', fmt(draft.total_taxable)], y)

  return y
}

// ─── Rental table ─────────────────────────────────────────────────────────────

function drawRentalTable(
  doc: JsPDFInstance,
  draft: InvoiceDraft,
  startY: number,
): number {
  const cols = [
    { label: 'Sl.\nNo.', width: 9, align: 'center' as const },
    { label: 'Vehicle\nType', width: 30, align: 'left' as const },
    { label: 'Reg. No.', width: 26, align: 'center' as const },
    { label: 'Billing\nMode', width: 22, align: 'center' as const },
    { label: 'Days', width: 14, align: 'center' as const },
    { label: 'Monthly\nRent (₹)', width: 30, align: 'right' as const },
    { label: 'Amount\n(₹)', width: 27, align: 'right' as const },
  ]

  // Billing period header note
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 96, 90)
  doc.text(
    `Billing Period: ${fmtDate(draft.billing_from)} to ${fmtDate(draft.billing_to)}`,
    M,
    startY,
  )

  let y = startY + 5
  y = drawTableHeader(doc, cols, y)

  draft.rental_items.forEach((item, idx) => {
    const mode = item.billing_mode === 'full_month' ? 'Full Month' : 'Partial'
    const days = item.billing_mode === 'partial_days' && item.num_days ? String(item.num_days) : '—'
    const rowValues = [
      String(idx + 1),
      item.vehicle_type ?? 'Vehicle',
      item.reg_number,
      mode,
      days,
      fmt(item.monthly_rent),
      fmt(item.subtotal),
    ]
    y = drawTableRow(doc, cols, rowValues, y)
  })

  y = drawTableFooterRow(doc, cols, ['', '', '', '', '', 'Total Taxable', fmt(draft.total_taxable)], y)

  return y
}

// ─── Shared table primitives ──────────────────────────────────────────────────

interface ColDef { label: string; width: number; align: 'left' | 'center' | 'right' }

function drawTableHeader(doc: JsPDFInstance, cols: ColDef[], y: number): number {
  const ROW_H = 9
  doc.setFillColor(212, 209, 202)
  doc.rect(M, y, CW, ROW_H, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(30, 25, 15)
  let x = M
  cols.forEach((col) => {
    const lines = col.label.split('\n')
    lines.forEach((line, i) => {
      const tx = col.align === 'right'
        ? x + col.width - 1
        : col.align === 'center'
          ? x + col.width / 2
          : x + 1
      doc.text(line, tx, y + 3 + i * 3.8, { align: col.align })
    })
    x += col.width
  })
  drawTableBorders(doc, cols, y, ROW_H)
  return y + ROW_H
}

function drawTableRow(doc: JsPDFInstance, cols: ColDef[], values: string[], y: number): number {
  const ROW_H = 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(30, 25, 15)
  let x = M
  cols.forEach((col, i) => {
    const tx = col.align === 'right'
      ? x + col.width - 1
      : col.align === 'center'
        ? x + col.width / 2
        : x + 1
    // Description column may need wrapping — truncate with ellipsis for now
    const text = values[i] ?? ''
    const maxW = col.width - 2
    const fitted = doc.getTextWidth(text) > maxW
      ? doc.splitTextToSize(text, maxW)[0] + '…'
      : text
    doc.text(fitted, tx, y + 4.5, { align: col.align })
    x += col.width
  })
  drawTableBorders(doc, cols, y, ROW_H)
  return y + ROW_H
}

function drawTableFooterRow(doc: JsPDFInstance, cols: ColDef[], values: string[], y: number): number {
  const ROW_H = 7
  doc.setFillColor(235, 232, 226)
  doc.rect(M, y, CW, ROW_H, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(30, 25, 15)
  let x = M
  cols.forEach((col, i) => {
    if (!values[i]) { x += col.width; return }
    const tx = col.align === 'right'
      ? x + col.width - 1
      : col.align === 'center'
        ? x + col.width / 2
        : x + 1
    doc.text(values[i], tx, y + 4.5, { align: col.align })
    x += col.width
  })
  drawTableBorders(doc, cols, y, ROW_H)
  return y + ROW_H
}

function drawTableBorders(doc: JsPDFInstance, cols: ColDef[], y: number, h: number): void {
  doc.setDrawColor(180, 170, 158)
  doc.setLineWidth(0.2)
  // Outer rect
  doc.rect(M, y, CW, h)
  // Vertical dividers
  let x = M
  cols.slice(0, -1).forEach((col) => {
    x += col.width
    doc.line(x, y, x, y + h)
  })
}

// ─── Totals block ─────────────────────────────────────────────────────────────

function drawTotals(doc: JsPDFInstance, draft: InvoiceDraft, y: number): number {
  const LW = 55  // label width
  const VW = 35  // value width
  const TX = M + CW - LW - VW  // totals block left edge
  const VX = TX + LW            // value column left edge

  const addRow = (label: string, value: string, bold = false, muted = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(muted ? 100 : 30, muted ? 96 : 25, muted ? 90 : 15)
    doc.text(label, TX, y)
    doc.text(value, VX + VW - 1, y, { align: 'right' })
    y += 5.5
  }

  addRow('Total Taxable Value', `₹ ${fmt(draft.total_taxable)}`)

  if (draft.tax_mode === 'cgst_sgst') {
    const half = draft.total_gst / 2
    addRow(`CGST @ ${draft.gst_rate / 2}%`, `₹ ${fmt(half)}`)
    addRow(`SGST @ ${draft.gst_rate / 2}%`, `₹ ${fmt(half)}`)
  } else {
    addRow(`IGST @ ${draft.gst_rate}%`, `₹ ${fmt(draft.total_gst)}`)
  }

  // Separator line
  doc.setDrawColor(180, 170, 158)
  doc.setLineWidth(0.3)
  doc.line(TX, y - 1, TX + LW + VW, y - 1)

  addRow('Total Invoice Amount', `₹ ${fmt(draft.total_amount)}`, true)

  // TDS informational line
  if (draft.tds_amount > 0) {
    addRow(`TDS @ ${draft.tds_rate}% (deducted by client)`, `- ₹ ${fmt(draft.tds_amount)}`, false, true)
    // Separator
    doc.setDrawColor(180, 170, 158)
    doc.line(TX, y - 1, TX + LW + VW, y - 1)
    addRow('Net Receivable', `₹ ${fmt(draft.net_receivable)}`, true)
  }

  return y
}
