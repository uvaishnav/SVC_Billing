import { supabase } from './supabaseClient'
import type { Payment, PaymentAllocation, ClientOutstandingSummary, InvoicePaymentStatus } from './types'

export interface PaymentAllocationPlanItem {
  invoiceId: number
  invoiceNumber: string
  invoiceDate: string
  workOrderRef: string | null
  billingPeriod: string
  netReceivable: number
  alreadyReceived: number
  balanceDue: number
  allocatedNow: number
  newBalanceDue: number
  newStatus: InvoicePaymentStatus
}

export interface FifoAllocationPreview {
  items: PaymentAllocationPlanItem[]
  totalAllocated: number
  unallocatedAdvance: number
}

// ─── Fetch Client Outstanding Bills (FIFO Order) ──────────────────────────────

/**
 * Fetches all finalized invoices for a client that have an outstanding balance,
 * sorted in ASCENDING order (oldest invoice_date, then invoice_number).
 */
export async function getClientOutstandingBills(clientId: number) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      invoice_date,
      billing_from,
      billing_to,
      net_receivable,
      status,
      work_orders(wo_reference)
    `)
    .eq('client_id', clientId)
    .eq('status', 'final')
    .order('invoice_date', { ascending: true })
    .order('invoice_number', { ascending: true })

  if (error) {
    console.error('getClientOutstandingBills error:', error)
    return []
  }

  const invoices = data ?? []
  if (invoices.length === 0) return []

  // Fetch allocations safely
  let allocsMap = new Map<number, number>()
  try {
    const invIds = invoices.map(i => i.id)
    const { data: allocData } = await (supabase
      .from('payment_allocations') as any)
      .select('invoice_id, allocated_amount')
      .in('invoice_id', invIds)

    if (allocData) {
      for (const a of allocData) {
        const prev = allocsMap.get(a.invoice_id) ?? 0
        allocsMap.set(a.invoice_id, prev + (Number(a.allocated_amount) || 0))
      }
    }
  } catch (err) {
    console.warn('getClientOutstandingBills allocations notice:', err)
  }

  return invoices
    .map(inv => {
      const alreadyReceived = allocsMap.get(inv.id) ?? 0
      const netReceivable = Number(inv.net_receivable ?? 0)
      const balanceDue = Math.max(0, Math.round((netReceivable - alreadyReceived) * 100) / 100)
      const woRef = (inv.work_orders as any)?.wo_reference ?? null

      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        billingPeriod: `${inv.billing_from} → ${inv.billing_to}`,
        workOrderRef: woRef,
        netReceivable,
        alreadyReceived,
        balanceDue,
      }
    })
    .filter(inv => inv.balanceDue > 0.01)
}

// ─── Simulate FIFO Allocation ──────────────────────────────────────────────────

/**
 * Computes how a given payment amount will be distributed across the client's
 * outstanding bills in ascending order (FIFO), without touching the database.
 */
export function calculateFifoAllocation(
  bills: Awaited<ReturnType<typeof getClientOutstandingBills>>,
  paymentAmount: number,
): FifoAllocationPreview {
  let remaining = Math.max(0, Math.round(paymentAmount * 100) / 100)
  const items: PaymentAllocationPlanItem[] = []

  for (const bill of bills) {
    if (remaining <= 0) {
      items.push({
        invoiceId: bill.id,
        invoiceNumber: bill.invoiceNumber,
        invoiceDate: bill.invoiceDate,
        workOrderRef: bill.workOrderRef,
        billingPeriod: bill.billingPeriod,
        netReceivable: bill.netReceivable,
        alreadyReceived: bill.alreadyReceived,
        balanceDue: bill.balanceDue,
        allocatedNow: 0,
        newBalanceDue: bill.balanceDue,
        newStatus: bill.alreadyReceived > 0.01 ? 'partially_cleared' : 'uncleared',
      })
      continue
    }

    const allocate = Math.min(remaining, bill.balanceDue)
    const roundedAllocate = Math.round(allocate * 100) / 100
    const newBalanceDue = Math.max(0, Math.round((bill.balanceDue - roundedAllocate) * 100) / 100)
    const newReceived = bill.alreadyReceived + roundedAllocate
    const newStatus: InvoicePaymentStatus = newBalanceDue <= 0.01 ? 'cleared' : (newReceived > 0.01 ? 'partially_cleared' : 'uncleared')

    items.push({
      invoiceId: bill.id,
      invoiceNumber: bill.invoiceNumber,
      invoiceDate: bill.invoiceDate,
      workOrderRef: bill.workOrderRef,
      billingPeriod: bill.billingPeriod,
      netReceivable: bill.netReceivable,
      alreadyReceived: bill.alreadyReceived,
      balanceDue: bill.balanceDue,
      allocatedNow: roundedAllocate,
      newBalanceDue,
      newStatus,
    })

    remaining = Math.max(0, Math.round((remaining - roundedAllocate) * 100) / 100)
  }

  const totalAllocated = items.reduce((sum, item) => sum + item.allocatedNow, 0)
  const unallocatedAdvance = remaining

  return {
    items,
    totalAllocated,
    unallocatedAdvance,
  }
}

// ─── Record Single Invoice Payment (Method 1) ──────────────────────────────────

export interface RecordInvoicePaymentParams {
  invoiceId: number
  clientId: number
  amount: number
  paymentDate: string
  paymentMode?: string | null
  referenceNumber?: string | null
  notes?: string | null
}

export async function recordInvoicePayment(params: RecordInvoicePaymentParams): Promise<{
  ok: boolean
  paymentId?: number
  error?: string
}> {
  const { invoiceId, clientId, amount, paymentDate, paymentMode, referenceNumber, notes } = params

  if (amount <= 0) {
    return { ok: false, error: 'Amount must be greater than 0.' }
  }

  // 1. Create payment
  const { data: payment, error: payErr } = await (supabase
    .from('payments') as any)
    .insert({
      client_id: clientId,
      payment_date: paymentDate,
      amount,
      payment_mode: paymentMode || null,
      reference_number: referenceNumber || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (payErr || !payment) {
    console.error('recordInvoicePayment - failed to create payment:', payErr)
    return { ok: false, error: payErr?.message ?? 'Failed to record payment.' }
  }

  // 2. Allocate payment to invoice
  const { error: allocErr } = await (supabase
    .from('payment_allocations') as any)
    .insert({
      payment_id: payment.id,
      invoice_id: invoiceId,
      allocated_amount: amount,
    })

  if (allocErr) {
    console.error('recordInvoicePayment - failed to allocate:', allocErr)
    // Rollback payment
    await (supabase.from('payments') as any).delete().eq('id', payment.id)
    return { ok: false, error: allocErr.message }
  }

  return { ok: true, paymentId: payment.id }
}

// ─── Record Lump-Sum Payment with FIFO Clearance (Method 2) ───────────────────

export interface RecordLumpSumPaymentParams {
  clientId: number
  amount: number
  paymentDate: string
  paymentMode?: string | null
  referenceNumber?: string | null
  notes?: string | null
}

export async function recordLumpSumPayment(params: RecordLumpSumPaymentParams): Promise<{
  ok: boolean
  paymentId?: number
  totalAllocated?: number
  unallocatedAdvance?: number
  allocationsCount?: number
  error?: string
}> {
  const { clientId, amount, paymentDate, paymentMode, referenceNumber, notes } = params

  if (amount <= 0) {
    return { ok: false, error: 'Amount must be greater than 0.' }
  }

  // 1. Fetch outstanding bills
  const bills = await getClientOutstandingBills(clientId)
  const preview = calculateFifoAllocation(bills, amount)

  // 2. Create payment record
  const { data: payment, error: payErr } = await (supabase
    .from('payments') as any)
    .insert({
      client_id: clientId,
      payment_date: paymentDate,
      amount,
      payment_mode: paymentMode || null,
      reference_number: referenceNumber || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (payErr || !payment) {
    console.error('recordLumpSumPayment - failed to insert payment:', payErr)
    return { ok: false, error: payErr?.message ?? 'Failed to insert payment record.' }
  }

  // 3. Insert allocations for all bills with allocatedNow > 0
  const activeAllocations = preview.items
    .filter(i => i.allocatedNow > 0)
    .map(i => ({
      payment_id: payment.id,
      invoice_id: i.invoiceId,
      allocated_amount: i.allocatedNow,
    }))

  if (activeAllocations.length > 0) {
    const { error: allocErr } = await (supabase
      .from('payment_allocations') as any)
      .insert(activeAllocations)

    if (allocErr) {
      console.error('recordLumpSumPayment - failed to insert allocations:', allocErr)
      await (supabase.from('payments') as any).delete().eq('id', payment.id)
      return { ok: false, error: allocErr.message }
    }
  }

  return {
    ok: true,
    paymentId: payment.id,
    totalAllocated: preview.totalAllocated,
    unallocatedAdvance: preview.unallocatedAdvance,
    allocationsCount: activeAllocations.length,
  }
}

// ─── Client Advance Tracking ──────────────────────────────────────────────────

export interface ClientAdvancePayment {
  paymentId: number
  paymentDate: string
  totalAmount: number
  allocatedAmount: number
  unallocatedAmount: number
  referenceNumber: string | null
  notes: string | null
}

export interface ClientAdvancesResult {
  totalPaid: number
  totalAllocated: number
  unallocatedAdvance: number
  advancePayments: ClientAdvancePayment[]
}

/**
 * Returns the unallocated advance balance for a client and the breakdown
 * of payments that have unallocated amounts.
 */
export async function getClientAdvances(clientId: number): Promise<ClientAdvancesResult> {
  const { data: payments, error } = await (supabase
    .from('payments') as any)
    .select(`
      id,
      payment_date,
      amount,
      reference_number,
      notes,
      payment_allocations(id, allocated_amount)
    `)
    .eq('client_id', clientId)
    .order('payment_date', { ascending: true })

  if (error || !payments) {
    console.error('getClientAdvances error:', error)
    return { totalPaid: 0, totalAllocated: 0, unallocatedAdvance: 0, advancePayments: [] }
  }

  let totalPaid = 0
  let totalAllocated = 0
  const advancePayments: ClientAdvancePayment[] = []

  for (const p of payments) {
    const pAmount = Number(p.amount ?? 0)
    totalPaid += pAmount

    const allocations = (p.payment_allocations ?? []) as any[]
    const pAllocated = allocations.reduce((sum, a) => sum + (Number(a.allocated_amount) || 0), 0)
    totalAllocated += pAllocated

    const unallocated = Math.max(0, Math.round((pAmount - pAllocated) * 100) / 100)
    if (unallocated > 0.01) {
      advancePayments.push({
        paymentId: p.id,
        paymentDate: p.payment_date,
        totalAmount: pAmount,
        allocatedAmount: pAllocated,
        unallocatedAmount: unallocated,
        referenceNumber: p.reference_number ?? null,
        notes: p.notes ?? null,
      })
    }
  }

  const unallocatedAdvance = Math.max(0, Math.round((totalPaid - totalAllocated) * 100) / 100)

  return {
    totalPaid,
    totalAllocated,
    unallocatedAdvance,
    advancePayments,
  }
}

// ─── Apply Advance to a Specific Invoice ──────────────────────────────────────

/**
 * Takes available advance from a client's payments and allocates it to an invoice.
 */
export async function applyAdvanceToInvoice(
  clientId: number,
  invoiceId: number,
  amountToApply: number,
): Promise<{ ok: boolean; error?: string }> {
  if (amountToApply <= 0) return { ok: false, error: 'Amount must be greater than 0.' }

  const advances = await getClientAdvances(clientId)
  if (advances.unallocatedAdvance < amountToApply - 0.01) {
    return { ok: false, error: `Available advance is only ₹${advances.unallocatedAdvance.toFixed(2)}.` }
  }

  let remainingToApply = Math.round(amountToApply * 100) / 100

  for (const adv of advances.advancePayments) {
    if (remainingToApply <= 0) break

    const take = Math.min(adv.unallocatedAmount, remainingToApply)
    const roundedTake = Math.round(take * 100) / 100

    // Check if an allocation already exists for this (payment_id, invoice_id)
    const { data: existing } = await (supabase
      .from('payment_allocations') as any)
      .select('id, allocated_amount')
      .eq('payment_id', adv.paymentId)
      .eq('invoice_id', invoiceId)
      .maybeSingle()

    if (existing) {
      const newAmount = Math.round((Number(existing.allocated_amount) + roundedTake) * 100) / 100
      const { error: updErr } = await (supabase
        .from('payment_allocations') as any)
        .update({ allocated_amount: newAmount })
        .eq('id', existing.id)

      if (updErr) return { ok: false, error: updErr.message }
    } else {
      const { error: insErr } = await (supabase
        .from('payment_allocations') as any)
        .insert({
          payment_id: adv.paymentId,
          invoice_id: invoiceId,
          allocated_amount: roundedTake,
        })

      if (insErr) return { ok: false, error: insErr.message }
    }

    remainingToApply = Math.max(0, Math.round((remainingToApply - roundedTake) * 100) / 100)
  }

  return { ok: true }
}

// ─── Delete Payment ───────────────────────────────────────────────────────────

export async function deletePayment(paymentId: number): Promise<{ ok: boolean; error?: string }> {
  // Cascades to allocations in DB
  const { error } = await (supabase.from('payments') as any)
    .delete()
    .eq('id', paymentId)

  if (error) {
    console.error('deletePayment error:', error)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

// ─── Client Summaries for Dashboard & Statements ──────────────────────────────

export async function getClientOutstandingSummaries(): Promise<ClientOutstandingSummary[]> {
  // 1. Fetch clients and finalized invoices
  const [invoicesRes, clientsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, client_id, net_receivable, status')
      .eq('status', 'final'),
    supabase
      .from('clients')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ])

  if (clientsRes.error) {
    console.error('getClientOutstandingSummaries clients error:', clientsRes.error)
    return []
  }

  const clients = clientsRes.data ?? []
  const invoices = invoicesRes.data ?? []

  // 2. Safely fetch payment allocations and payments
  const allocsByInvoice = new Map<number, number>()
  const allocsByPayment = new Map<number, number>()
  let payments: any[] = []

  try {
    const [allocsData, paymentsData] = await Promise.all([
      (supabase.from('payment_allocations') as any).select('id, payment_id, invoice_id, allocated_amount'),
      (supabase.from('payments') as any).select('id, client_id, amount'),
    ])

    if (allocsData?.data) {
      for (const a of allocsData.data) {
        const amt = Number(a.allocated_amount) || 0
        allocsByInvoice.set(a.invoice_id, (allocsByInvoice.get(a.invoice_id) ?? 0) + amt)
        allocsByPayment.set(a.payment_id, (allocsByPayment.get(a.payment_id) ?? 0) + amt)
      }
    }
    if (paymentsData?.data) {
      payments = paymentsData.data
    }
  } catch (err) {
    console.warn('getClientOutstandingSummaries payments query notice:', err)
  }

  const summaries: ClientOutstandingSummary[] = []

  for (const c of clients) {
    const clientInvoices = invoices.filter(i => i.client_id === c.id)
    const clientPayments = payments.filter((p: any) => p.client_id === c.id)

    let totalInvoiced = 0
    let totalReceived = 0
    let totalPending = 0
    let pendingInvoicesCount = 0

    for (const inv of clientInvoices) {
      const net = Number(inv.net_receivable ?? 0)
      totalInvoiced += net

      const received = allocsByInvoice.get(inv.id) ?? 0
      totalReceived += received

      const balance = Math.max(0, Math.round((net - received) * 100) / 100)
      if (balance > 0.01) {
        totalPending += balance
        pendingInvoicesCount += 1
      }
    }

    // Client total payments vs total allocations for unallocated advance
    let totalClientPaid = 0
    let totalClientAllocated = 0
    for (const p of clientPayments) {
      totalClientPaid += Number(p.amount ?? 0)
      totalClientAllocated += allocsByPayment.get(p.id) ?? 0
    }

    const unallocatedAdvance = Math.max(0, Math.round((totalClientPaid - totalClientAllocated) * 100) / 100)

    // Only include clients who have had invoices or payments
    if (totalInvoiced > 0 || totalClientPaid > 0) {
      summaries.push({
        client_id: c.id,
        client_name: c.name,
        total_invoiced: Math.round(totalInvoiced * 100) / 100,
        total_received: Math.round(totalReceived * 100) / 100,
        total_pending: Math.round(totalPending * 100) / 100,
        unallocated_advance: unallocatedAdvance,
        pending_invoices_count: pendingInvoicesCount,
      })
    }
  }

  return summaries.sort((a, b) => b.total_pending - a.total_pending)
}

