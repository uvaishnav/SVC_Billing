// Invoices list page — redesigned for iOS PWA (ui/ios-premium-redesign)
// Uses real InvoiceWithDetails type from invoicesDb.
import { useEffect, useMemo, useState } from 'react'
import type { InvoiceWithDetails, InvoiceStatus } from '../../db/types'
import {
  getInvoices,
  getInvoiceById,
  mapInvoiceWithDetailsToDraft,
  deleteDraftInvoice,
  cancelInvoice,
} from '../../db/invoicesDb'
import type { InvoiceDraft } from '../../db/types'
import { sectionTitleStyle } from '../settings/_components'
import InvoiceWizard from './InvoiceWizard'
import { InvoiceActions } from './InvoiceActions'
import MarkReceivedModal from './MarkReceivedModal'
import OutstandingStatementModal from '../reports/OutstandingStatementModal'
import ErrorBoundary from '../common/ErrorBoundary'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n?: number | null): string {
  const val = typeof n === 'number' && !isNaN(n) ? n : 0
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}

function getFY(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const fyStart = m >= 4 ? y : y - 1
  return `${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`
}

function currentFY(): string {
  return getFY(new Date().toISOString())
}

function sortByNumberDesc(arr: InvoiceWithDetails[]): InvoiceWithDetails[] {
  return [...arr].sort((a, b) => {
    const numA = parseInt((a.invoice_number ?? '').replace(/\D+/g, '').slice(-6) || '0', 10)
    const numB = parseInt((b.invoice_number ?? '').replace(/\D+/g, '').slice(-6) || '0', 10)
    if (numB !== numA) return numB - numA
    return (b.invoice_number ?? '').localeCompare(a.invoice_number ?? '')
  })
}

// ── Status badge colours ──────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  draft:     'var(--color-warning)',
  final:     'var(--color-accent)',
  cancelled: 'var(--color-error)',
}

const STATUS_BG: Record<string, string> = {
  draft:     'rgba(160,92,26,0.10)',
  final:     'rgba(200,169,106,0.12)',
  cancelled: 'rgba(139,46,46,0.10)',
}

const PAYMENT_BADGE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  cleared: {
    label: 'Cleared',
    color: 'var(--color-success)',
    bg: 'rgba(90,122,46,0.12)',
    icon: '🟢',
  },
  partially_cleared: {
    label: 'Partial',
    color: 'var(--color-warning)',
    bg: 'rgba(160,92,26,0.12)',
    icon: '🟠',
  },
  uncleared: {
    label: 'Uncleared',
    color: 'var(--color-terracotta, #8C4A32)',
    bg: 'rgba(140,74,50,0.10)',
    icon: '⚪',
  },
}

// ── Delete-draft button ───────────────────────────────────────────────────────

function DeleteDraftButton({ invoiceId, onDeleted }: { invoiceId: number; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    const result = await deleteDraftInvoice(invoiceId)
    setDeleting(false)
    if (result.ok) onDeleted()
    else { alert(result.error ?? 'Delete failed.'); setConfirming(false) }
  }

  if (confirming) {
    return (
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--color-error)', fontWeight: 600 }}>Delete?</span>
        <button type="button" onClick={handleDelete} disabled={deleting}
          style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--color-error)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >{deleting ? '…' : 'Yes'}</button>
        <button type="button" onClick={e => { e.stopPropagation(); setConfirming(false) }}
          aria-label="Cancel delete"
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >No</button>
      </div>
    )
  }

  return (
    <button type="button" onClick={handleDelete} aria-label="Delete draft invoice"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: 'rgba(255,255,255,0.45)', fontSize: 16, lineHeight: 1, transition: 'color 150ms' }}
      onMouseEnter={e => (e.currentTarget.style.color = '#ff6b6b')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
    >🗑️</button>
  )
}

// ── Cancel-invoice button ─────────────────────────────────────────────────────

function CancelInvoiceButton({ invoiceId, onCancelled }: { invoiceId: number; onCancelled: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  async function handleConfirm(e: React.MouseEvent) {
    e.stopPropagation()
    setCancelling(true)
    const result = await cancelInvoice(invoiceId)
    setCancelling(false)
    if (result.ok) onCancelled()
    else { alert(result.error ?? 'Cancel failed.'); setConfirming(false) }
  }

  if (confirming) {
    return (
      <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-highlight, rgba(139,46,46,0.08))', border: '1px solid var(--color-error)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 12, color: 'var(--color-error)', fontWeight: 600, margin: 0 }}>⚠️ This will void the invoice and reverse all billed quantities.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleConfirm} disabled={cancelling}
            style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: 'var(--color-error)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >{cancelling ? 'Cancelling…' : 'Yes, void invoice'}</button>
          <button type="button" onClick={e => { e.stopPropagation(); setConfirming(false) }}
            aria-label="Keep invoice"
            style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >Keep it</button>
        </div>
      </div>
    )
  }

  return (
    <button type="button" onClick={e => { e.stopPropagation(); setConfirming(true) }}
      aria-label="Cancel invoice"
      style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: '1px solid var(--color-error)', background: 'transparent', color: 'var(--color-error)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 150ms, color 150ms' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-error)'; e.currentTarget.style.color = '#fff' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-error)' }}
    >🚫 Cancel Invoice</button>
  )
}

// ── VOID stamp ────────────────────────────────────────────────────────────────

function VoidStamp() {
  return (
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-20deg)', border: '3px solid var(--color-error)', borderRadius: 6, padding: '4px 14px', fontSize: 28, fontWeight: 900, letterSpacing: '0.15em', color: 'var(--color-error)', opacity: 0.18, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>VOID</div>
  )
}

// ── Invoice card ──────────────────────────────────────────────────────────────

function InvoiceCard({
  inv, onOpen, onDeleted, onCancelled, onMarkReceived, loadingEdit,
}: {
  inv: InvoiceWithDetails
  onOpen: (inv: InvoiceWithDetails) => void
  onDeleted: (id: number) => void
  onCancelled: (id: number) => void
  onMarkReceived: (inv: InvoiceWithDetails) => void
  loadingEdit: number | null
}) {
  const isDraft     = inv.status === 'draft'
  const isFinal     = inv.status === 'final'
  const isCancelled = inv.status === 'cancelled'
  const st          = inv.status ?? 'draft'
  const pStatus     = inv.payment_status ?? 'uncleared'
  const pConfig     = PAYMENT_BADGE_CONFIG[pStatus] ?? PAYMENT_BADGE_CONFIG.uncleared

  const netReceivable = Number(inv.net_receivable ?? 0)
  const totalReceived = Number(inv.total_received ?? 0)
  const balanceDue    = Number(inv.balance_due ?? netReceivable)
  const pctReceived   = netReceivable > 0 ? Math.min(100, Math.max(0, Math.round((totalReceived / netReceivable) * 100))) : (pStatus === 'cleared' ? 100 : 0)

  // Status-driven left border color
  const leftBorderColor = isCancelled
    ? 'var(--color-error)'
    : isDraft
    ? 'var(--color-accent)'
    : pStatus === 'cleared'
    ? 'var(--color-success)'
    : pStatus === 'partially_cleared'
    ? 'var(--color-warning)'
    : 'var(--color-terracotta, #8C4A32)'

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: '16px',
      border: '1px solid var(--color-border)',
      borderLeft: `5px solid ${leftBorderColor}`,
      boxShadow: '0 2px 8px rgba(43,31,21,0.05), 0 6px 20px rgba(43,31,21,0.03)',
      position: 'relative',
      overflow: 'hidden',
      opacity: loadingEdit === inv.id || isCancelled ? (isCancelled ? 0.75 : 0.6) : 1,
      transition: 'all 200ms ease',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {isCancelled && <VoidStamp />}

      {/* Top Row: Invoice Number, Client, & Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🧾</span>
            <h3 style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--color-primary)',
              fontFamily: 'Playfair Display, serif',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {inv.invoice_number}
            </h3>
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text)',
            marginTop: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            <span style={{ opacity: 0.6, fontSize: 12 }}>🏢</span>
            <span>{inv.client_name ?? '—'}</span>
          </div>
        </div>

        {/* Right Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 20,
            color: STATUS_COLOR[st] ?? 'var(--color-text-muted)',
            background: STATUS_BG[st] ?? 'transparent',
            border: `1px solid ${STATUS_COLOR[st] ?? 'var(--color-border)'}`,
            textTransform: 'capitalize',
          }}>
            {st}
          </span>

          {isFinal && (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 20,
              color: pConfig.color,
              background: pConfig.bg,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span>{pConfig.icon}</span>
              <span>{pConfig.label}</span>
            </span>
          )}

          {isDraft && <DeleteDraftButton invoiceId={inv.id} onDeleted={() => onDeleted(inv.id)} />}
          {loadingEdit === inv.id && <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>Loading…</span>}
        </div>
      </div>

      {/* Metadata Row: Date, Period, WO */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--color-surface-offset)', padding: '3px 8px', borderRadius: 6 }}>
          <span>📅</span> {inv.invoice_date}
        </span>
        {(inv.billing_from || inv.billing_to) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--color-surface-offset)', padding: '3px 8px', borderRadius: 6 }}>
            <span>🕒</span> {inv.billing_from} → {inv.billing_to}
          </span>
        )}
        {inv.work_order_reference && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(200,169,106,0.15)', color: 'var(--color-primary)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
            <span>🔖</span> WO #{inv.work_order_reference}
          </span>
        )}
      </div>

      {/* Financials 3-Part Summary Block */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 6,
        background: 'var(--color-surface-offset)',
        padding: '10px 12px',
        borderRadius: 10,
        textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
            Total Billed
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: isCancelled ? 'var(--color-text-faint)' : 'var(--color-text)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
            ₹{fmt(netReceivable)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
            Received
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
            ₹{fmt(totalReceived)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
            Balance Due
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: isCancelled ? 'var(--color-text-faint)' : (balanceDue <= 0.01 ? 'var(--color-success)' : 'var(--color-warning)'),
            fontVariantNumeric: 'tabular-nums',
            marginTop: 2,
          }}>
            ₹{fmt(balanceDue)}
          </div>
        </div>
      </div>

      {/* Payment Progress Bar (for final invoices) */}
      {isFinal && (
        <div style={{ marginTop: -2, marginBottom: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: 'var(--color-text-faint)', fontSize: 10 }}>Collection Progress</span>
            <span style={{
              fontWeight: 700,
              fontSize: 11,
              color: pStatus === 'cleared' ? 'var(--color-success)' : (pStatus === 'partially_cleared' ? 'var(--color-warning)' : 'var(--color-text-faint)'),
            }}>
              {pStatus === 'cleared' ? '100% Cleared ✓' : `${pctReceived}% Paid`}
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--color-surface-offset)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pctReceived}%`,
              background: pStatus === 'cleared' ? 'var(--color-success)' : 'linear-gradient(90deg, var(--color-accent), var(--color-warning))',
              borderRadius: 999,
              transition: 'width 250ms ease-out',
            }} />
          </div>
        </div>
      )}

      {/* Draft: tap to continue editing */}
      {isDraft && (
        <div
          onClick={() => onOpen(inv)}
          role="button"
          tabIndex={0}
          aria-label={`Edit draft invoice ${inv.invoice_number}`}
          style={{
            marginTop: 4,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(200, 169, 106, 0.15)',
            border: '1px dashed var(--color-accent)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <span>✏️</span>
          <span>Tap to continue drafting this invoice</span>
        </div>
      )}

      {/* Final: Action Toolbar */}
      {isFinal && (
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {/* Mark Received Button (shown if invoice has pending balance) */}
          {balanceDue > 0.01 && (
            <button
              type="button"
              onClick={() => onMarkReceived(inv)}
              aria-label={`Mark received for ${inv.invoice_number}`}
              style={{
                width: '100%',
                minHeight: 40,
                padding: '9px 14px',
                borderRadius: 10,
                border: '1.5px solid var(--color-accent)',
                background: 'rgba(200, 169, 106, 0.16)',
                color: 'var(--color-primary)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 1px 4px rgba(200, 169, 106, 0.2)',
                transition: 'all 150ms',
              }}
            >
              <span>💰</span> Mark Received (Due: ₹{fmt(balanceDue)})
            </button>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <InvoiceActions invoiceId={inv.id} invoiceNumber={inv.invoice_number} status={inv.status} />
            </div>
            <button
              type="button"
              disabled={loadingEdit === inv.id}
              onClick={() => onOpen(inv)}
              aria-label={`Edit invoice ${inv.invoice_number}`}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1.5px solid var(--color-primary)',
                background: 'transparent',
                color: 'var(--color-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 150ms',
                opacity: loadingEdit === inv.id ? 0.6 : 1,
              }}
            >
              {loadingEdit === inv.id ? '…' : '✏️ Edit'}
            </button>
          </div>

          <CancelInvoiceButton invoiceId={inv.id} onCancelled={() => onCancelled(inv.id)} />
        </div>
      )}

      {/* Cancelled: PDF only */}
      {isCancelled && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: 4 }}>
          <InvoiceActions invoiceId={inv.id} invoiceNumber={inv.invoice_number} status={inv.status} />
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FilterStatus = 'final' | 'draft' | 'cancelled' | 'all'
type PaymentFilter = 'all' | 'uncleared' | 'partially_cleared' | 'cleared'

export default function InvoicesPage() {
  const [invoices,           setInvoices]           = useState<InvoiceWithDetails[]>([])
  const [loading,            setLoading]            = useState(true)
  const [search,             setSearch]             = useState('')
  const [selectedFY,         setSelectedFY]         = useState<string>(currentFY())
  const [statusFilter,       setStatusFilter]       = useState<FilterStatus>('final')
  const [paymentFilter,      setPaymentFilter]      = useState<PaymentFilter>('all')
  const [showWizard,         setShowWizard]         = useState(false)
  const [editDraft,          setEditDraft]          = useState<InvoiceDraft | undefined>(undefined)
  const [editStatus,         setEditStatus]         = useState<InvoiceStatus | undefined>(undefined)
  const [editInvoiceId,      setEditInvoiceId]      = useState<number | null>(null)
  const [loadingEdit,        setLoadingEdit]        = useState<number | null>(null)
  const [markReceivedInv,    setMarkReceivedInv]    = useState<InvoiceWithDetails | null>(null)
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false)

  async function load() {
    setLoading(true)
    try {
      const data = await getInvoices()
      setInvoices(data)
    } catch (err) {
      console.error('Failed to load invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const availableFYs = useMemo(() => {
    const fySet = new Set<string>()
    for (const inv of invoices) {
      const fy = getFY(inv.invoice_date)
      if (fy) fySet.add(fy)
    }
    const sorted = Array.from(fySet).sort((a, b) => b.localeCompare(a))
    if (!fySet.has(currentFY())) sorted.unshift(currentFY())
    return sorted
  }, [invoices])

  // If the default currentFY() has no invoices, auto-select the latest FY that has invoices
  useEffect(() => {
    if (invoices.length > 0) {
      const hasInSelected = invoices.some(i => (i.status === 'draft' ? selectedFY === currentFY() : getFY(i.invoice_date) === selectedFY))
      if (!hasInSelected) {
        const existingFys = Array.from(new Set(invoices.map(i => getFY(i.invoice_date)).filter(Boolean))).sort((a, b) => b.localeCompare(a))
        if (existingFys.length > 0 && existingFys[0]) {
          setSelectedFY(existingFys[0])
        }
      }
    }
  }, [invoices])

  // Invoices filtered by active FY
  const fyInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const isDraft = inv.status === 'draft'
      return isDraft ? selectedFY === currentFY() : getFY(inv.invoice_date) === selectedFY
    })
  }, [invoices, selectedFY])

  // Pre-calculated counts for filters in the selected FY
  const counts = useMemo(() => {
    const total = fyInvoices.length
    const finalCount = fyInvoices.filter(i => i.status === 'final').length
    const draftCount = fyInvoices.filter(i => i.status === 'draft').length
    const cancelledCount = fyInvoices.filter(i => i.status === 'cancelled').length

    const finalInvoices = fyInvoices.filter(i => i.status === 'final')
    const unclearedCount = finalInvoices.filter(i => (i.payment_status ?? 'uncleared') === 'uncleared').length
    const partialCount = finalInvoices.filter(i => i.payment_status === 'partially_cleared').length
    const clearedCount = finalInvoices.filter(i => i.payment_status === 'cleared').length

    return {
      total,
      final: finalCount,
      draft: draftCount,
      cancelled: cancelledCount,
      uncleared: unclearedCount,
      partial: partialCount,
      cleared: clearedCount,
    }
  }, [fyInvoices])

  // Financial KPI totals for the selected FY
  const kpis = useMemo(() => {
    const active = fyInvoices.filter(i => i.status !== 'cancelled')
    const totalBilled = active.reduce((sum, i) => sum + (Number(i.net_receivable) || 0), 0)
    const totalReceived = active.reduce((sum, i) => sum + (Number(i.total_received) || 0), 0)
    const totalDue = active.reduce((sum, i) => sum + (Number(i.balance_due ?? i.net_receivable) || 0), 0)
    return {
      totalBilled,
      totalReceived,
      totalDue,
    }
  }, [fyInvoices])

  // Search & filter matching
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const result = fyInvoices.filter(inv => {
      const statusOk  = statusFilter === 'all' || inv.status === statusFilter
      const paymentOk = paymentFilter === 'all' || (inv.status === 'final' && (inv.payment_status ?? 'uncleared') === paymentFilter)
      const searchOk  = !term ||
        (inv.invoice_number ?? '').toLowerCase().includes(term) ||
        (inv.client_name   ?? '').toLowerCase().includes(term) ||
        (inv.work_order_reference ?? '').toLowerCase().includes(term)
      return statusOk && paymentOk && searchOk
    })
    return sortByNumberDesc(result)
  }, [fyInvoices, statusFilter, paymentFilter, search])

  async function handleOpen(inv: InvoiceWithDetails) {
    setLoadingEdit(inv.id)
    try {
      const fresh = await getInvoiceById(inv.id)
      if (!fresh) { alert('Invoice not found.'); return }
      const mappedDraft = await mapInvoiceWithDetailsToDraft(fresh)
      setEditDraft(mappedDraft)
      setEditStatus(fresh.status)
      setEditInvoiceId(fresh.id)
      setShowWizard(true)
    } catch (err) {
      alert('Failed to load invoice details.')
    } finally {
      setLoadingEdit(null)
    }
  }

  function handleDeleted(id: number) {
    setInvoices(prev => prev.filter(i => i.id !== id))
  }

  function handleCancelled(id: number) {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' as InvoiceStatus } : i))
  }

  if (showWizard) {
    return (
      <InvoiceWizard
        initialDraft={editDraft}
        existingStatus={editStatus}
        existingInvoiceId={editInvoiceId ?? undefined}
        onComplete={() => { setShowWizard(false); setEditDraft(undefined); setEditStatus(undefined); setEditInvoiceId(null); load() }}
      />
    )
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)', paddingBottom: 'calc(var(--nav-height, 60px) + 24px)' }}>
      {/* ─── Sticky header with Executive KPIs ─── */}
      <div className="page-header">
        {/* Title & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, color: 'var(--color-accent)', margin: 0, fontFamily: 'Playfair Display, serif' }}>
              Invoices & Billing
            </h1>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              FY {selectedFY} &bull; {counts.total} Bill{counts.total === 1 ? '' : 's'} recorded
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowStatementModal(true)}
              style={{
                background: 'rgba(200,169,106,0.18)',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Work Sans, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 38,
                transition: 'all 150ms',
              }}
            >
              <span>📄</span> Statement Report
            </button>
            <button
              type="button"
              onClick={() => { setEditDraft(undefined); setEditStatus(undefined); setEditInvoiceId(null); setShowWizard(true) }}
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-primary)',
                border: 'none',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Work Sans, sans-serif',
                boxShadow: '0 2px 8px rgba(200,169,106,0.25)',
                minHeight: 38,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>+</span> New Invoice
            </button>
          </div>
        </div>

        {/* Executive Financial Summary KPIs for Selected FY */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          <div style={{ background: 'rgba(200, 169, 106, 0.12)', border: '1px solid rgba(200, 169, 106, 0.3)', borderRadius: 12, padding: '9px 10px' }}>
            <div style={{ fontSize: 10, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Total Billed</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
              ₹{fmt(kpis.totalBilled)}
            </div>
          </div>
          <div style={{ background: 'rgba(90, 122, 46, 0.18)', border: '1px solid rgba(90, 122, 46, 0.35)', borderRadius: 12, padding: '9px 10px' }}>
            <div style={{ fontSize: 10, color: '#88C057', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Collected</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#A5D6A7', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
              ₹{fmt(kpis.totalReceived)}
            </div>
          </div>
          <div style={{ background: 'rgba(160, 92, 26, 0.22)', border: '1px solid rgba(160, 92, 26, 0.4)', borderRadius: 12, padding: '9px 10px' }}>
            <div style={{ fontSize: 10, color: '#E59866', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Pending Due</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#FFCC80', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
              ₹{fmt(kpis.totalDue)}
            </div>
          </div>
        </div>

        {/* Search Input with Clear Button */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.6, pointerEvents: 'none' }}>
            🔍
          </span>
          <input
            type="search"
            placeholder="Search invoice #, client, or WO ref…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 34px 9px 36px',
              borderRadius: 10,
              border: '1px solid rgba(200, 169, 106, 0.35)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              fontSize: 14,
              fontFamily: 'Work Sans, sans-serif',
              outline: 'none',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontSize: 13,
                padding: 4,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* FY Tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
          {availableFYs.map(fy => (
            <button
              key={fy}
              type="button"
              onClick={() => setSelectedFY(fy)}
              style={{
                flexShrink: 0,
                fontSize: 12,
                padding: '5px 14px',
                borderRadius: 20,
                minHeight: 30,
                border: `1px solid ${selectedFY === fy ? 'var(--color-accent)' : 'rgba(255,255,255,0.18)'}`,
                background: selectedFY === fy ? 'var(--color-accent)' : 'transparent',
                color: selectedFY === fy ? 'var(--color-primary)' : 'rgba(255,255,255,0.65)',
                fontWeight: selectedFY === fy ? 700 : 500,
                cursor: 'pointer',
                fontFamily: 'Work Sans, sans-serif',
                transition: 'all 180ms',
              }}
            >
              FY {fy}
            </button>
          ))}
        </div>

        {/* Status Filter Tabs with Live Count Badges */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
          {(['final', 'draft', 'cancelled', 'all'] as FilterStatus[]).map(s => {
            const cnt = s === 'all' ? counts.total : counts[s]
            const isActive = statusFilter === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                style={{
                  flexShrink: 0,
                  fontSize: 12,
                  padding: '5px 12px',
                  borderRadius: 20,
                  minHeight: 30,
                  border: `1px solid ${isActive ? (STATUS_COLOR[s] ?? 'var(--color-accent)') : 'rgba(255,255,255,0.18)'}`,
                  background: isActive ? (STATUS_BG[s] ?? 'rgba(200,169,106,0.2)') : 'rgba(255,255,255,0.06)',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'Work Sans, sans-serif',
                  textTransform: 'capitalize',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 180ms',
                }}
              >
                <span>{s === 'all' ? 'All' : s}</span>
                <span style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                }}>
                  {cnt}
                </span>
              </button>
            )
          })}
        </div>

        {/* Payment Sub-filters (when viewing final or all invoices) with Count Badges */}
        {(statusFilter === 'final' || statusFilter === 'all') && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', alignSelf: 'center', marginRight: 2, flexShrink: 0 }}>Payment:</span>
            {[
              { id: 'all', label: 'All', count: counts.final },
              { id: 'uncleared', label: '⚪ Uncleared', count: counts.uncleared },
              { id: 'partially_cleared', label: '🟠 Partial', count: counts.partial },
              { id: 'cleared', label: '🟢 Cleared', count: counts.cleared },
            ].map(p => {
              const isActive = paymentFilter === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaymentFilter(p.id as PaymentFilter)}
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    padding: '3px 9px',
                    borderRadius: 16,
                    border: `1px solid ${isActive ? 'var(--color-accent)' : 'rgba(255,255,255,0.15)'}`,
                    background: isActive ? 'rgba(200, 169, 106, 0.25)' : 'transparent',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    fontFamily: 'Work Sans, sans-serif',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 150ms',
                  }}
                >
                  <span>{p.label}</span>
                  <span style={{
                    fontSize: 9,
                    padding: '0 5px',
                    borderRadius: 8,
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  }}>
                    {p.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Invoices List ─── */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              height: 120, borderRadius: 16,
              background: 'linear-gradient(90deg, var(--color-surface-offset) 25%, var(--color-surface-dynamic, #e6e4df) 50%, var(--color-surface-offset) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-faint)' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
              No {statusFilter === 'all' ? '' : statusFilter} invoices found
            </div>
            {invoices.length > 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 360, margin: '0 auto' }}>
                You have {invoices.length} invoice{invoices.length === 1 ? '' : 's'} across other FYs or filter settings. Switch financial year or clear search to view.
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Tap "+ New Invoice" above to create your first bill.
              </div>
            )}
          </div>
        ) : (
          filtered.map(inv => (
            <InvoiceCard
              key={inv.id}
              inv={inv}
              onOpen={handleOpen}
              onDeleted={handleDeleted}
              onCancelled={handleCancelled}
              onMarkReceived={setMarkReceivedInv}
              loadingEdit={loadingEdit}
            />
          ))
        )}
      </div>

      {/* ─── Mark Received Modal (Method 1) ─── */}
      {markReceivedInv && (
        <ErrorBoundary fallbackTitle="Payment Receipt Error" onClose={() => setMarkReceivedInv(null)}>
          <MarkReceivedModal
            invoice={markReceivedInv}
            onClose={() => setMarkReceivedInv(null)}
            onSuccess={() => {
              setMarkReceivedInv(null)
              load()
            }}
          />
        </ErrorBoundary>
      )}

      {/* ─── Client Outstanding Statement Modal (PDF Report) ─── */}
      {showStatementModal && (
        <ErrorBoundary fallbackTitle="Statement Report Error" onClose={() => setShowStatementModal(false)}>
          <OutstandingStatementModal
            onClose={() => setShowStatementModal(false)}
          />
        </ErrorBoundary>
      )}
    </div>
  )
}
