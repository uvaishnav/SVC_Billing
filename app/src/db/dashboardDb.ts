import { supabase } from './supabaseClient'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KpiData {
  thisMonthRevenue: number        // sum of finalized invoice totals for current month
  thisFyRevenue: number           // sum of finalized invoice totals for current FY
  activeWoCount: number           // work orders with status != 'closed'
  expiringWoCount: number         // WOs expiring within 30 days
}

export interface UnbilledVehicle {
  vehicleId: number
  regNumber: string
  yearMonth: string               // 'YYYY-MM'
  isIgnored: boolean
}

export interface VehicleRevenue {
  vehicleId: number
  regNumber: string
  totalRevenue: number
}

export interface WoFlag {
  woId: number
  woReference: string
  subject: string
  flagType: 'expiring_soon' | 'near_limit'
  daysUntilExpiry?: number        // for expiring_soon
  utilizationPct?: number         // for near_limit (0-100)
}

export interface RecentInvoice {
  id: number
  invoiceNumber: string | null
  clientName: string
  totalInvoiceAmount: number
  status: string
  invoiceDate: string
}

export interface DashboardIgnore {
  vehicleId: number
  yearMonth: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns current financial year start date string 'YYYY-04-01' */
function fyStart(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-04-01`
}

/** Returns 'YYYY-MM' for a given Date */
function toYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export async function fetchKpis(): Promise<KpiData> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const fyStartDate = fyStart()
  const today = now.toISOString().slice(0, 10)
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [monthRes, fyRes, woRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('total_invoice_amount')
      .eq('status', 'final')
      .gte('invoice_date', monthStart)
      .lte('invoice_date', monthEnd),
    supabase
      .from('invoices')
      .select('total_invoice_amount')
      .eq('status', 'final')
      .gte('invoice_date', fyStartDate),
    supabase
      .from('work_orders')
      .select('id, valid_to')
      .neq('status', 'closed'),
  ])

  const thisMonthRevenue = (monthRes.data ?? []).reduce((s, r) => s + (r.total_invoice_amount ?? 0), 0)
  const thisFyRevenue = (fyRes.data ?? []).reduce((s, r) => s + (r.total_invoice_amount ?? 0), 0)
  const wos = woRes.data ?? []
  const activeWoCount = wos.length
  const expiringWoCount = wos.filter(w => w.valid_to && w.valid_to >= today && w.valid_to <= in30Days).length

  return { thisMonthRevenue, thisFyRevenue, activeWoCount, expiringWoCount }
}

// ─── Unbilled Vehicles ────────────────────────────────────────────────────────

export async function fetchUnbilledVehicles(): Promise<UnbilledVehicle[]> {
  const now = new Date()
  const currentYM = toYearMonth(now)
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevYM = toYearMonth(prevDate)
  const checkMonths = [prevYM, currentYM]

  const [vehiclesRes, ledgerRes, ignoresRes] = await Promise.all([
    supabase.from('vehicles').select('id, reg_number').eq('is_active', true),
    supabase
      .from('vehicle_billing_ledger')
      .select('vehicle_id, billing_period_from')
      .in('billing_period_from', [
        new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
        new Date(prevDate.getFullYear(), prevDate.getMonth(), 1).toISOString().slice(0, 10),
        // also match any date in those months via gte/lte in post-processing
      ]),
    supabase.from('dashboard_ignores').select('vehicle_id, year_month'),
  ])

  const vehicles = vehiclesRes.data ?? []
  const ledger = ledgerRes.data ?? []
  const ignores = ignoresRes.data ?? []

  // Build sets: which vehicle-months have been billed
  const billedSet = new Set<string>()
  for (const row of ledger) {
    if (!row.billing_period_from) continue
    const ym = row.billing_period_from.slice(0, 7) // 'YYYY-MM'
    billedSet.add(`${row.vehicle_id}::${ym}`)
  }

  const ignoredSet = new Set<string>(
    ignores.map(i => `${i.vehicle_id}::${i.year_month}`)
  )

  const unbilled: UnbilledVehicle[] = []
  for (const v of vehicles) {
    for (const ym of checkMonths) {
      const key = `${v.id}::${ym}`
      if (!billedSet.has(key)) {
        unbilled.push({
          vehicleId: v.id,
          regNumber: v.reg_number,
          yearMonth: ym,
          isIgnored: ignoredSet.has(key),
        })
      }
    }
  }

  return unbilled
}

// ─── Vehicle Revenue ──────────────────────────────────────────────────────────

/** period: 'month' = current month, 'fy' = current FY */
export async function fetchVehicleRevenue(period: 'month' | 'fy'): Promise<VehicleRevenue[]> {
  const now = new Date()
  let fromDate: string
  let toDate: string

  if (period === 'month') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  } else {
    fromDate = fyStart()
    toDate = now.toISOString().slice(0, 10)
  }

  const [ledgerRes, vehiclesRes] = await Promise.all([
    supabase
      .from('vehicle_billing_ledger')
      .select('vehicle_id, subtotal, billing_period_from')
      .gte('billing_period_from', fromDate)
      .lte('billing_period_from', toDate),
    supabase.from('vehicles').select('id, reg_number').eq('is_active', true),
  ])

  const vehicles = vehiclesRes.data ?? []
  const ledger = ledgerRes.data ?? []

  const revenueMap: Record<number, number> = {}
  for (const row of ledger) {
    revenueMap[row.vehicle_id] = (revenueMap[row.vehicle_id] ?? 0) + (row.subtotal ?? 0)
  }

  return vehicles
    .map(v => ({ vehicleId: v.id, regNumber: v.reg_number, totalRevenue: revenueMap[v.id] ?? 0 }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
}

// ─── Work Order Flags ─────────────────────────────────────────────────────────

export async function fetchWoFlags(): Promise<WoFlag[]> {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [woRes, itemsRes] = await Promise.all([
    supabase
      .from('work_orders')
      .select('id, wo_reference, subject, valid_to, total_value')
      .neq('status', 'closed'),
    supabase
      .from('work_order_items')
      .select('work_order_id, rate, contracted_qty, cumulative_billed_qty'),
  ])

  const wos = woRes.data ?? []
  const items = itemsRes.data ?? []

  // Build WO total billed map
  const woContracted: Record<number, number> = {}
  const woBilled: Record<number, number> = {}
  for (const item of items) {
    const contracted = (item.contracted_qty ?? 0) * (item.rate ?? 0)
    const billed = (item.cumulative_billed_qty ?? 0) * (item.rate ?? 0)
    woContracted[item.work_order_id] = (woContracted[item.work_order_id] ?? 0) + contracted
    woBilled[item.work_order_id] = (woBilled[item.work_order_id] ?? 0) + billed
  }

  const flags: WoFlag[] = []

  for (const wo of wos) {
    // Expiring soon flag
    if (wo.valid_to && wo.valid_to >= today && wo.valid_to <= in30Days) {
      const daysUntilExpiry = Math.ceil(
        (new Date(wo.valid_to).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      flags.push({
        woId: wo.id,
        woReference: wo.wo_reference ?? '',
        subject: wo.subject,
        flagType: 'expiring_soon',
        daysUntilExpiry,
      })
    }

    // Near limit flag (>= 80% utilized by billed amount)
    const contracted = woContracted[wo.id] ?? wo.total_value ?? 0
    const billed = woBilled[wo.id] ?? 0
    if (contracted > 0) {
      const pct = (billed / contracted) * 100
      if (pct >= 80) {
        flags.push({
          woId: wo.id,
          woReference: wo.wo_reference ?? '',
          subject: wo.subject,
          flagType: 'near_limit',
          utilizationPct: Math.round(pct),
        })
      }
    }
  }

  return flags.sort((a, b) => {
    // expiring_soon first, then near_limit; within expiring, fewest days first
    if (a.flagType !== b.flagType) return a.flagType === 'expiring_soon' ? -1 : 1
    return (a.daysUntilExpiry ?? 100) - (b.daysUntilExpiry ?? 100)
  })
}

// ─── Recent Invoices ──────────────────────────────────────────────────────────

export async function fetchRecentInvoices(): Promise<RecentInvoice[]> {
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, client_id, total_invoice_amount, status, invoice_date, clients(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  return (data ?? []).map((r: any) => ({
    id: r.id,
    invoiceNumber: r.invoice_number,
    clientName: r.clients?.name ?? '—',
    totalInvoiceAmount: r.total_invoice_amount ?? 0,
    status: r.status,
    invoiceDate: r.invoice_date,
  }))
}

// ─── Ignore / Unignore ────────────────────────────────────────────────────────

export async function ignoreUnbilledMonth(vehicleId: number, yearMonth: string, note?: string): Promise<void> {
  await supabase
    .from('dashboard_ignores')
    .upsert({ vehicle_id: vehicleId, year_month: yearMonth, note: note ?? null }, { onConflict: 'vehicle_id,year_month' })
}

export async function unignoreUnbilledMonth(vehicleId: number, yearMonth: string): Promise<void> {
  await supabase
    .from('dashboard_ignores')
    .delete()
    .eq('vehicle_id', vehicleId)
    .eq('year_month', yearMonth)
}
