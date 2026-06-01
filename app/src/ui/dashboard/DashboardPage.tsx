import React, { useEffect, useRef, useState } from 'react'
import {
  fetchKpis, fetchUnbilledVehicles, fetchVehicleRevenue, fetchWoFlags, fetchMonthlyTrend,
  ignoreUnbilledMonth, unignoreUnbilledMonth,
} from '../../db/dashboardDb'
import type { KpiData, UnbilledVehicle, VehicleRevenue, WoFlag, MonthlyTrend } from '../../db/dashboardDb'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
}

function currentFyLabel(): string {
  const now = new Date()
  const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `FY ${String(fy).slice(2)}-${String(fy + 1).slice(2)}`
}

function currentMonthLabel(): string {
  return new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

// ─── Vehicle Revenue Chart ────────────────────────────────────────────────────

function VehicleRevenueChart({ data, period, onPeriodChange }: {
  data: VehicleRevenue[]
  period: 'month' | 'fy'
  onPeriodChange: (p: 'month' | 'fy') => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    function buildChart() {
      const ChartJS = (window as any).Chart
      if (!ChartJS || !canvasRef.current) return
      if (chartRef.current) { chartRef.current.destroy() }

      const top10  = data.slice(0, 10)
      const labels = top10.map(v => v.regNumber)
      const values = top10.map(v => v.totalRevenue)
      const maxVal = Math.max(...values, 1)

      chartRef.current = new ChartJS(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: values.map(v => v === 0 ? 'rgba(184,169,154,0.35)' : 'rgba(200,169,106,0.85)'),
            borderColor:     values.map(v => v === 0 ? 'rgba(184,169,154,0.5)'  : 'rgba(200,169,106,1)'),
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx: any) => fmt(ctx.raw) } },
          },
          scales: {
            x: {
              beginAtZero: true,
              max: maxVal * 1.15,
              ticks: { font: { family: 'Work Sans, sans-serif', size: 11 }, color: '#7A6A58', callback: (v: any) => fmt(Number(v)) },
              grid: { color: 'rgba(217,211,197,0.6)' },
            },
            y: {
              ticks: { font: { family: 'Work Sans, sans-serif', size: 12 }, color: '#2A1F15' },
              grid: { display: false },
            },
          },
        },
      })
    }

    if (!(window as any).Chart) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js'
      script.onload = buildChart
      document.head.appendChild(script)
    } else {
      buildChart()
    }

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [data])

  const chartHeight = Math.max(200, Math.min(data.length, 10) * 42 + 32)

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: '16px 16px 12px', boxShadow: '0 1px 4px rgba(59,42,31,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'Playfair Display, serif' }}>Vehicle Revenue</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['month', 'fy'] as const).map(p => (
            <button key={p} type="button" onClick={() => onPeriodChange(p)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 20,
              border: '1px solid var(--color-border)',
              background: period === p ? 'var(--color-accent)' : 'transparent',
              color: period === p ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: period === p ? 600 : 400, cursor: 'pointer',
              fontFamily: 'Work Sans, sans-serif',
            }}>
              {p === 'month' ? 'Month' : currentFyLabel()}
            </button>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-faint)', fontSize: 13 }}>No data yet</div>
      ) : (
        <div style={{ height: chartHeight }}><canvas ref={canvasRef} /></div>
      )}
    </div>
  )
}

// ─── Monthly Billing Trend ────────────────────────────────────────────────────

function MonthlyTrendChart({ data }: { data: MonthlyTrend[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    function buildChart() {
      const ChartJS = (window as any).Chart
      if (!ChartJS || !canvasRef.current || data.length === 0) return
      if (chartRef.current) { chartRef.current.destroy() }

      const now     = new Date()
      const currYM  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const labels  = data.map(d => monthLabel(d.yearMonth))
      const values  = data.map(d => d.total)
      const maxVal  = Math.max(...values, 1)

      // Colour current month accent gold, past months teal-ish
      const bgColors = data.map(d =>
        d.yearMonth === currYM ? 'rgba(200,169,106,0.9)' : 'rgba(1,105,111,0.55)'
      )
      const borderColors = data.map(d =>
        d.yearMonth === currYM ? 'rgba(200,169,106,1)' : 'rgba(1,105,111,0.85)'
      )

      chartRef.current = new ChartJS(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 1,
            borderRadius: 5,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx: any) => fmt(ctx.raw) } },
          },
          scales: {
            x: {
              ticks: { font: { family: 'Work Sans, sans-serif', size: 11 }, color: '#7A6A58' },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              max: maxVal * 1.2,
              ticks: { font: { family: 'Work Sans, sans-serif', size: 10 }, color: '#7A6A58', callback: (v: any) => fmt(Number(v)) },
              grid: { color: 'rgba(217,211,197,0.5)' },
            },
          },
        },
      })
    }

    // Chart.js may already be loaded from VehicleRevenueChart — reuse it
    if (!(window as any).Chart) {
      const existing = document.querySelector('script[src*="chart.js"]')
      if (!existing) {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js'
        script.onload = buildChart
        document.head.appendChild(script)
      } else {
        (existing as HTMLScriptElement).addEventListener('load', buildChart)
      }
    } else {
      buildChart()
    }

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [data])

  // Summary stats below chart
  const nonZero  = data.filter(d => d.total > 0)
  const avg      = nonZero.length > 0 ? nonZero.reduce((s, d) => s + d.total, 0) / nonZero.length : 0
  const peak     = data.reduce((best, d) => d.total > best.total ? d : best, data[0] ?? { total: 0, yearMonth: '' })
  const current  = data[data.length - 1]
  const prev     = data[data.length - 2]
  const momDiff  = prev && prev.total > 0 ? ((current.total - prev.total) / prev.total) * 100 : null

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: '16px 16px 14px', boxShadow: '0 1px 4px rgba(59,42,31,0.07)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'Playfair Display, serif' }}>6-Month Billing Trend</span>
        {momDiff !== null && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            background: momDiff >= 0 ? 'rgba(67,122,34,0.12)' : 'rgba(160,92,26,0.12)',
            color: momDiff >= 0 ? 'var(--color-success)' : 'var(--color-warning)',
          }}>
            {momDiff >= 0 ? '▲' : '▼'} {Math.abs(momDiff).toFixed(1)}% vs last month
          </span>
        )}
      </div>

      {/* Bar chart */}
      {data.length === 0 || data.every(d => d.total === 0) ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-faint)', fontSize: 13 }}>No billing data yet</div>
      ) : (
        <div style={{ height: 160 }}><canvas ref={canvasRef} /></div>
      )}

      {/* Stat pills */}
      {avg > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <StatPill label="Monthly avg" value={fmt(avg)} />
          <StatPill label={`Peak (${monthLabel(peak.yearMonth)})`} value={fmt(peak.total)} accent />
        </div>
      )}
    </div>
  )
}

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      flex: 1, minWidth: 120,
      background: accent ? 'rgba(200,169,106,0.1)' : 'var(--color-surface-offset)',
      borderRadius: 8, padding: '8px 12px',
      border: `1px solid ${accent ? 'rgba(200,169,106,0.3)' : 'var(--color-border)'}`,
    }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-faint)', letterSpacing: '0.3px', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: accent ? 'rgba(160,120,40,1)' : 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

// ─── Unbilled Alert ───────────────────────────────────────────────────────────

function UnbilledAlert({ items, onIgnore, onUnignore }: {
  items: UnbilledVehicle[]
  onIgnore: (vehicleId: number, yearMonth: string) => void
  onUnignore: (vehicleId: number, yearMonth: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const active  = items.filter(i => !i.isIgnored)
  const ignored = items.filter(i => i.isIgnored)

  if (items.length === 0) return null

  return (
    <div style={{
      background: active.length > 0 ? 'rgba(160,92,26,0.08)' : 'rgba(90,122,46,0.08)',
      border: `1px solid ${active.length > 0 ? 'rgba(160,92,26,0.3)' : 'rgba(90,122,46,0.3)'}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      <button type="button" onClick={() => setExpanded(e => !e)} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      }}>
        <span style={{ fontSize: 18 }}>{active.length > 0 ? '⚠️' : '✅'}</span>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          {active.length > 0
            ? `${active.length} vehicle-month${active.length > 1 ? 's' : ''} not billed`
            : 'All recent months accounted for'}
        </span>
        {ignored.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{ignored.length} ignored</span>
        )}
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: '200ms' }}>▼</span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '8px 14px 12px' }}>
          {active.length > 0 && (
            <div style={{ marginBottom: ignored.length > 0 ? 12 : 0 }}>
              {active.map(item => (
                <div key={`${item.vehicleId}-${item.yearMonth}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.04)',
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{item.regNumber}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>{monthLabel(item.yearMonth)}</span>
                  </div>
                  <button type="button" onClick={() => onIgnore(item.vehicleId, item.yearMonth)} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 20,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-offset)',
                    color: 'var(--color-text-muted)', cursor: 'pointer',
                    fontFamily: 'Work Sans, sans-serif',
                  }}>Ignore</button>
                </div>
              ))}
            </div>
          )}
          {ignored.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-faint)', letterSpacing: '0.5px', marginBottom: 6 }}>IGNORED (vehicle was idle)</div>
              {ignored.map(item => (
                <div key={`${item.vehicleId}-${item.yearMonth}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 0', opacity: 0.65,
                }}>
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>{item.regNumber}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-faint)', marginLeft: 8 }}>{monthLabel(item.yearMonth)}</span>
                  </div>
                  <button type="button" onClick={() => onUnignore(item.vehicleId, item.yearMonth)} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 20,
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-primary)', cursor: 'pointer',
                    fontFamily: 'Work Sans, sans-serif',
                  }}>Restore</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KpiStrip({ kpis }: { kpis: KpiData | null }) {
  const items = [
    { label: currentMonthLabel(), value: kpis ? fmt(kpis.thisMonthRevenue) : '…', sub: 'Billed' },
    { label: currentFyLabel(),    value: kpis ? fmt(kpis.thisFyRevenue)    : '…', sub: 'Total' },
    { label: 'Work Orders',       value: kpis ? String(kpis.activeWoCount) : '…', sub: 'Active' },
    {
      label: 'Expiring', value: kpis ? String(kpis.expiringWoCount) : '…', sub: '≤30 days',
      accent: kpis && kpis.expiringWoCount > 0 ? 'var(--color-warning)' : undefined,
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {items.map(item => (
        <div key={item.label} style={{
          background: 'var(--color-surface)', borderRadius: 10, padding: '12px 14px',
          boxShadow: '0 1px 4px rgba(59,42,31,0.07)',
          borderLeft: item.accent ? `3px solid ${item.accent}` : '3px solid transparent',
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-faint)', marginBottom: 2, letterSpacing: '0.3px' }}>{item.label}</div>
          <div style={{
            fontSize: 20, fontWeight: 700, color: item.accent ?? 'var(--color-primary)',
            fontFamily: 'Work Sans, sans-serif', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
          }}>{item.value}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{item.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── WO Flags ─────────────────────────────────────────────────────────────────

function WoFlags({ flags }: { flags: WoFlag[] }) {
  if (flags.length === 0) return null
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: '14px 14px 10px', boxShadow: '0 1px 4px rgba(59,42,31,0.07)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'Playfair Display, serif', marginBottom: 10 }}>Work Order Flags</div>
      {flags.map(f => {
        const isExpiring = f.flagType === 'expiring_soon'
        const accent = isExpiring
          ? (f.daysUntilExpiry! <= 7 ? 'var(--color-error)' : 'var(--color-warning)')
          : (f.utilizationPct! >= 95 ? 'var(--color-error)' : 'var(--color-warning)')
        return (
          <div key={`${f.woId}-${f.flagType}`} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '8px 0', borderBottom: '1px solid var(--color-surface-offset)',
          }}>
            <span style={{ fontSize: 15, marginTop: 1 }}>{isExpiring ? '⏰' : '📊'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                {f.woReference ? `[${f.woReference}]` : ''} {f.subject.length > 50 ? f.subject.slice(0, 50) + '…' : f.subject}
              </div>
              <div style={{ fontSize: 11, color: accent, marginTop: 2 }}>
                {isExpiring
                  ? `Expires in ${f.daysUntilExpiry} day${f.daysUntilExpiry === 1 ? '' : 's'}`
                  : `${f.utilizationPct}% of contract value billed`}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [kpis,           setKpis]           = useState<KpiData | null>(null)
  const [unbilled,       setUnbilled]       = useState<UnbilledVehicle[]>([])
  const [vehicleRevenue, setVehicleRevenue] = useState<VehicleRevenue[]>([])
  const [revPeriod,      setRevPeriod]      = useState<'month' | 'fy'>('month')
  const [woFlags,        setWoFlags]        = useState<WoFlag[]>([])
  const [monthlyTrend,   setMonthlyTrend]   = useState<MonthlyTrend[]>([])
  const [loading,        setLoading]        = useState(true)

  async function loadAll() {
    setLoading(true)
    const [k, u, v, f, t] = await Promise.all([
      fetchKpis(),
      fetchUnbilledVehicles(),
      fetchVehicleRevenue('month'),
      fetchWoFlags(),
      fetchMonthlyTrend(),
    ])
    setKpis(k)
    setUnbilled(u)
    setVehicleRevenue(v)
    setWoFlags(f)
    setMonthlyTrend(t)
    setLoading(false)
  }

  async function handleRevPeriodChange(p: 'month' | 'fy') {
    setRevPeriod(p)
    const v = await fetchVehicleRevenue(p)
    setVehicleRevenue(v)
  }

  async function handleIgnore(vehicleId: number, yearMonth: string) {
    await ignoreUnbilledMonth(vehicleId, yearMonth)
    setUnbilled(prev => prev.map(i =>
      i.vehicleId === vehicleId && i.yearMonth === yearMonth ? { ...i, isIgnored: true } : i
    ))
  }

  async function handleUnignore(vehicleId: number, yearMonth: string) {
    await unignoreUnbilledMonth(vehicleId, yearMonth)
    setUnbilled(prev => prev.map(i =>
      i.vehicleId === vehicleId && i.yearMonth === yearMonth ? { ...i, isIgnored: false } : i
    ))
  }

  useEffect(() => { loadAll() }, [])

  const activeUnbilled = unbilled.filter(i => !i.isIgnored).length

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>
      {/* Sticky header */}
      <div style={{
        background: 'var(--color-primary)', padding: '20px 20px 16px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, color: 'var(--color-accent)', margin: 0, lineHeight: 1.2 }}>Dashboard</h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{currentMonthLabel()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeUnbilled > 0 && !loading && (
              <div style={{
                background: 'var(--color-warning)', color: 'white',
                borderRadius: 20, fontSize: 11, fontWeight: 700,
                padding: '3px 9px', letterSpacing: '0.3px',
              }}>{activeUnbilled} unbilled</div>
            )}
            <button type="button" onClick={loadAll} style={{
              background: 'rgba(200,169,106,0.15)', border: '1px solid rgba(200,169,106,0.3)',
              borderRadius: 8, color: 'var(--color-accent)', fontSize: 18,
              padding: '4px 8px', cursor: 'pointer',
            }}>↻</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[80, 100, 180, 200].map((h, i) => (
              <div key={i} style={{
                height: h, borderRadius: 12,
                background: 'linear-gradient(90deg, var(--color-surface-offset) 25%, var(--color-surface) 50%, var(--color-surface-offset) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }} />
            ))}
            <style>{`@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`}</style>
          </div>
        )}

        {!loading && (
          <>
            <UnbilledAlert items={unbilled} onIgnore={handleIgnore} onUnignore={handleUnignore} />
            <KpiStrip kpis={kpis} />
            <VehicleRevenueChart data={vehicleRevenue} period={revPeriod} onPeriodChange={handleRevPeriodChange} />
            <WoFlags flags={woFlags} />
            <MonthlyTrendChart data={monthlyTrend} />
          </>
        )}
      </div>
    </div>
  )
}
