import { supabase } from './supabaseClient'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KpiData {
  thisMonthRevenue: number
  thisFyRevenue: number
  activeWoCount: number
  expiringWoCount: number
}

export interface UnbilledVehicle {
  vehicleId: number
  regNumber: string
  yearMonth: string   // 'YYYY-MM'
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
  daysUntilExpiry?: number
  utilizationPct?: number
}

export interface MonthlyTrend {
  yearMonth: string   // 'YYYY-MM'
  total: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns 'YY-YY' FY label e.g. '25-26' */
function fyLabel(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${String(year).slice(2)}-${String(year + 1).slice(2)}`
}

/** Returns 'YYYY-MM' for a given Date */
function toYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Returns first day of current month as 'YYYY-MM-DD' */
function currentMonthStart(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

/** Returns last day of current month as 'YYYY-MM-DD' */
function currentMonthEnd(): string {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return lastDay.toISOString().slice(0, 10)
}

/** Returns array of last N 'YYYY-MM' strings, oldest first */
function lastNMonths(n: number): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    months.push(toYearMonth(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  }
  return months
}

// ─── KPIs ──────────────────────────────────────────────────────────────────────

export async function fetchKpis(): Promise<KpiData> {
  const now        = new Date()
  const monthStart = currentMonthStart()
  const monthEnd   = currentMonthEnd()
  const currentFY  = fyLabel()
  const today      = now.toISOString().slice(0, 10)
  const in30Days   = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)

  const [monthRes, fyRes, woRes] = await Promise.all([
    // This Month Revenue: sum net_receivable of final invoices raised THIS calendar month
    supabase
      .from('invoices')
      .select('net_receivable')
      .eq('status', 'final')
      .gte('invoice_date', monthStart)
      .lte('invoice_date', monthEnd),

    // FY Revenue: sum amount from ledger for current financial year
    supabase
      .from('vehicle_billing_ledger')
      .select('amount')
      .eq('financial_year', currentFY),

    // Work Orders
    supabase
      .from('work_orders')
      .select('id, valid_to')
      .neq('status', 'closed'),
  ])

  const thisMonthRevenue = (monthRes.data ?? []).reduce((s, r) => s + (r.net_receivable ?? 0), 0)
  const thisFyRevenue    = (fyRes.data   ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const wos              = woRes.data ?? []
  const activeWoCount    = wos.length
  const expiringWoCount  = wos.filter(w => w.valid_to && w.valid_to >= today && w.valid_to <= in30Days).length

  return { thisMonthRevenue, thisFyRevenue, activeWoCount, expiringWoCount }
}

// ─── Unbilled Vehicles ────────────────────────────────────────────────────────
// Shows active vehicles that have NOT been billed in any final invoice
// raised this calendar month (invoice_date). Covers both quantity invoices
// (invoice_vehicles) and rental invoices (invoice_rental_items).

export async function fetchUnbilledVehicles(): Promise<UnbilledVehicle[]> {
  const now        = new Date()
  const currentYM  = toYearMonth(now)
  const monthStart = currentMonthStart()
  const monthEnd   = currentMonthEnd()

  const [
    vehiclesRes,
    ignoresRes,
    qtyVehiclesRes,
    rentalVehiclesRes,
  ] = await Promise.all([
    supabase.from('vehicles').select('id, reg_number').eq('is_active', true),
    supabase.from('dashboard_ignores').select('vehicle_id, year_month'),
    // quantity invoices: vehicles via invoice_vehicles
    supabase
      .from('invoice_vehicles')
      .select('vehicle_id, invoices!inner(invoice_date, status)')
      .eq('invoices.status', 'final')
      .gte('invoices.invoice_date', monthStart)
      .lte('invoices.invoice_date', monthEnd),
    // rental invoices: vehicles via invoice_rental_items
    supabase
      .from('invoice_rental_items')
      .select('vehicle_id, invoices!inner(invoice_date, status)')
      .eq('invoices.status', 'final')
      .gte('invoices.invoice_date', monthStart)
      .lte('invoices.invoice_date', monthEnd),
  ])

  const vehicles = vehiclesRes.data ?? []
  const ignores  = ignoresRes.data ?? []

  // Union: vehicle billed this month via either billing type
  const billedThisMonthSet = new Set<number>([
    ...(qtyVehiclesRes.data    ?? []).map((r: any) => r.vehicle_id),
    ...(rentalVehiclesRes.data ?? []).map((r: any) => r.vehicle_id),
  ])

  const ignoredSet = new Set<string>(
    ignores.map(i => `${i.vehicle_id}::${i.year_month}`)
  )

  const unbilled: UnbilledVehicle[] = []
  for (const v of vehicles) {
    if (!billedThisMonthSet.has(v.id)) {
      unbilled.push({
        vehicleId: v.id,
        regNumber: v.reg_number,
        yearMonth: currentYM,
        isIgnored: ignoredSet.has(`${v.id}::${currentYM}`),
      })
    }
  }

  return unbilled
}

// ─── Vehicle Revenue ─────────────────────────────────────────────────────────

export async function fetchVehicleRevenue(period: 'month' | 'fy'): Promise<VehicleRevenue[]> {
  const now = new Date()
  const prevMonthYM = toYearMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))

  const [ledgerRes, vehiclesRes] = await Promise.all([
    period === 'month'
      ? supabase
          .from('vehicle_billing_ledger')
          .select('vehicle_id, amount')
          .eq('billing_month', prevMonthYM)
      : supabase
          .from('vehicle_billing_ledger')
          .select('vehicle_id, amount')
          .eq('financial_year', fyLabel()),
    supabase.from('vehicles').select('id, reg_number').eq('is_active', true),
  ])

  const vehicles = vehiclesRes.data ?? []
  const ledger   = ledgerRes.data ?? []

  const revenueMap: Record<number, number> = {}
  for (const row of ledger) {
    revenueMap[row.vehicle_id] = (revenueMap[row.vehicle_id] ?? 0) + (row.amount ?? 0)
  }

  return vehicles
    .map(v => ({ vehicleId: v.id, regNumber: v.reg_number, totalRevenue: revenueMap[v.id] ?? 0 }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
}

// ─── Work Order Flags ─────────────────────────────────────────────────────────

export async function fetchWoFlags(): Promise<WoFlag[]> {
  const now      = new Date()
  const today    = now.toISOString().slice(0, 10)
  const in30Days = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)

  const [woRes, itemsRes] = await Promise.all([
    supabase
      .from('work_orders')
      .select('id, wo_reference, subject, valid_to, total_value')
      .neq('status', 'closed'),
    supabase
      .from('work_order_items')
      .select('work_order_id, rate, contracted_qty, cumulative_billed_qty'),
  ])

  const wos   = woRes.data ?? []
  const items = itemsRes.data ?? []

  const woContracted: Record<number, number> = {}
  const woBilled:     Record<number, number> = {}
  for (const item of items) {
    const contracted = (item.contracted_qty ?? 0) * (item.rate ?? 0)
    const billed     = (item.cumulative_billed_qty ?? 0) * (item.rate ?? 0)
    woContracted[item.work_order_id] = (woContracted[item.work_order_id] ?? 0) + contracted
    woBilled[item.work_order_id]     = (woBilled[item.work_order_id]     ?? 0) + billed
  }

  const flags: WoFlag[] = []
  for (const wo of wos) {
    if (wo.valid_to && wo.valid_to >= today && wo.valid_to <= in30Days) {
      flags.push({
        woId: wo.id,
        woReference: wo.wo_reference ?? '',
        subject: wo.subject,
        flagType: 'expiring_soon',
        daysUntilExpiry: Math.ceil((new Date(wo.valid_to).getTime() - now.getTime()) / 86400000),
      })
    }
    const contracted = woContracted[wo.id] ?? wo.total_value ?? 0
    const billed     = woBilled[wo.id] ?? 0
    if (contracted > 0 && (billed / contracted) * 100 >= 80) {
      flags.push({
        woId: wo.id,
        woReference: wo.wo_reference ?? '',
        subject: wo.subject,
        flagType: 'near_limit',
        utilizationPct: Math.round((billed / contracted) * 100),
      })
    }
  }

  return flags.sort((a, b) => {
    if (a.flagType !== b.flagType) return a.flagType === 'expiring_soon' ? -1 : 1
    return (a.daysUntilExpiry ?? 100) - (b.daysUntilExpiry ?? 100)
  })
}

// ─── Monthly Billing Trend (last 6 months) ───────────────────────────────────

export async function fetchMonthlyTrend(): Promise<MonthlyTrend[]> {
  const months = lastNMonths(6)

  const { data } = await supabase
    .from('vehicle_billing_ledger')
    .select('billing_month, amount')
    .in('billing_month', months)

  const totals: Record<string, number> = {}
  for (const ym of months) totals[ym] = 0
  for (const row of (data ?? [])) {
    if (totals[row.billing_month] !== undefined) {
      totals[row.billing_month] += row.amount ?? 0
    }
  }

  return months.map(ym => ({ yearMonth: ym, total: totals[ym] }))
}

// ─── Ignore / Unignore ───────────────────────────────────────────────────────

export async function ignoreUnbilledMonth(vehicleId: number, yearMonth: string): Promise<void> {
  await supabase
    .from('dashboard_ignores')
    .upsert({ vehicle_id: vehicleId, year_month: yearMonth }, { onConflict: 'vehicle_id,year_month' })
}

export async function unignoreUnbilledMonth(vehicleId: number, yearMonth: string): Promise<void> {
  await supabase
    .from('dashboard_ignores')
    .delete()
    .eq('vehicle_id', vehicleId)
    .eq('year_month', yearMonth)
}
