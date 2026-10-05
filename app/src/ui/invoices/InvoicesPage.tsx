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

// ── Date and Billing Month Formatters ─────────────────────────────────────────

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function parseYMD(str?: string | null): { year: number; month: number; day: number } | null {
  if (!str) return null
  const clean = str.trim().split('T')[0]
  const parts = clean.split(/[-/]/)
  if (parts.length < 3) return null
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null
  return { year: y, month: m, day: d }
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  const p = parseYMD(dateStr)
  if (!p) return dateStr
  const day = String(p.day).padStart(2, '0')
  const month = MONTH_SHORT[p.month - 1]
  return `${day} ${month} ${p.year}`
}

function formatBillingMonths(
  fromStr?: string | null,
  toStr?: string | null,
  fallbackDateStr?: string | null
): string {
  const from = parseYMD(fromStr)
  const to = parseYMD(toStr)

  if (!from && !to) {
    const fallback = parseYMD(fallbackDateStr)
    if (!fallback) return ''
    return `${MONTH_FULL[fallback.month - 1]} ${fallback.year}`
  }

  const start = from ?? to!
  const end = to ?? from!

  const months: { month: number; year: number }[] = []
  let curY = start.year
  let curM = start.month

  let guard = 0
  while (guard < 36) {
    guard++
    months.push({ month: curM, year: curY })
    if (curY === end.year && curM === end.month) break
    if (curY > end.year || (curY === end.year && curM > end.month)) break
    curM++
    if (curM > 12) {
      curM = 1
      curY++
    }
  }

  if (months.length === 0) return ''
  if (months.length === 1) {
    return `${MONTH_FULL[months[0].month - 1]} ${months[0].year}`
  }

  const allSameYear = months.every(item => item.year === months[0].year)
  if (allSameYear) {
    const names = months.map(item => MONTH_SHORT[item.month - 1]).join(', ')
    return `${names} ${months[0].year}`
  }

  return months.map(item => `${MONTH_SHORT[item.month - 1]} ${item.year}`).join(', ')
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

const PAYMENT_BADGE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  cleared: {
    label: 'Cleared',
    color: 'var(--color-success)',
    bg: 'rgba(90,122,46,0.12)',
    dot: '#5A7A2E',
  },
  partially_cleared: {
    label: 'Partial',
    color: 'var(--color-warning)',
    bg: 'rgba(160,92,26,0.12)',
    dot: '#A05C1A',
  },
  uncleared: {
    label: 'Uncleared',
    color: 'var(--color-text-muted)',
    bg: 'var(--color-surface-offset)',
    dot: 'var(--color-text-faint)',
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
        <span style={{ fontSize: 11, color: 'var(--color-error)', fontWeight: 600 }}>Delete?</span>
        <button type="button" onClick={handleDelete} disabled={deleting}
          style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: 'var(--color-error)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >{deleting ? '…' : 'Yes'}</button>
        <button type="button" onClick={e => { e.stopPropagation(); setConfirming(false) }}
          aria-label="Cancel delete"
          style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >No</button>
      </div>
    )
  }

  return (
    <button type="button" onClick={handleDelete} aria-label="Delete draft invoice"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, color: 'var(--color-text-faint)', fontSize: 12, fontWeight: 500, transition: 'color 150ms' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-error)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-faint)')}
    >
      Delete
    </button>
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
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%',
        marginTop: 4,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'var(--color-error-highlight, rgba(139,46,46,0.08))',
        border: '1px solid var(--color-error)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <p style={{ fontSize: 12, color: 'var(--color-error)', fontWeight: 600, margin: 0 }}>
          This will void the invoice and reverse billed quantities.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleConfirm} disabled={cancelling}
            style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: 'var(--color-error)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >{cancelling ? 'Cancelling…' : 'Yes, Void'}</button>
          <button type="button" onClick={e => { e.stopPropagation(); setConfirming(false) }}
            aria-label="Keep invoice"
            style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <button type="button" onClick={e => { e.stopPropagation(); setConfirming(true) }}
      aria-label="Void invoice"
      style={{
        flex: '0 0 auto',
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid rgba(139,46,46,0.24)',
        background: 'transparent',
        color: 'var(--color-error)',
        fontSize: 12.5,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minHeight: 36,
        transition: 'all 150ms ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(139,46,46,0.06)'
        e.currentTarget.style.borderColor = 'var(--color-error)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'rgba(139,46,46,0.24)'
      }}
    >
      <span>✕</span>
      <span>Void</span>
    </button>
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
  showStatusBadge = true, showPaymentBadge = true,
}: {
  inv: InvoiceWithDetails
  onOpen: (inv: InvoiceWithDetails) => void
  onDeleted: (id: number) => void
  onCancelled: (id: number) => void
  onMarkReceived: (inv: InvoiceWithDetails) => void
  loadingEdit: number | null
  showStatusBadge?: boolean
  showPaymentBadge?: boolean
}) {
  const isDraft     = inv.status === 'draft'
  const isFinal     = inv.status === 'final'
  const isCancelled = inv.status === 'cancelled'
  const st          = inv.status ?? 'draft'
  const pStatus     = inv.payment_status ?? 'uncleared'
  const pConfig     = PAYMENT_BADGE_CONFIG[pStatus] ?? PAYMENT_BADGE_CONFIG.uncleared

  const netReceivable = Number(inv.net_receivable ?? 0)
  const balanceDue    = Number(inv.balance_due ?? netReceivable)
  const billingMonth  = formatBillingMonths(inv.billing_from, inv.billing_to, inv.invoice_date)

  return (
    <div style={{
      background: 'var(--color-surface-2, #FFFFFF)',
      borderRadius: 16,
      padding: '16px',
      border: '1px solid rgba(217, 211, 197, 0.75)',
      boxShadow: '0 2px 10px rgba(59,42,31,0.04)',
      position: 'relative',
      overflow: 'hidden',
      opacity: loadingEdit === inv.id || isCancelled ? (isCancelled ? 0.72 : 0.6) : 1,
      transition: 'opacity 150ms',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {isCancelled && <VoidStamp />}

      {/* Top Row: P1 Invoice Number + P2 Invoice Date (less visual prominence) & P3 Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 16.5,
            fontWeight: 700,
            color: 'var(--color-primary)',
            fontFamily: 'Playfair Display, Georgia, serif',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap',
          }}>
            {inv.invoice_number}
          </span>
          {inv.invoice_date && (
            <span style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
              <span style={{ opacity: 0.35, margin: '0 4px 0 1px' }}>•</span>
              {formatDisplayDate(inv.invoice_date)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* P3 Status Badge: only shown when filter includes multiple types (e.g. statusFilter='all') */}
          {showStatusBadge && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
              color: STATUS_COLOR[st] ?? 'var(--color-text-muted)',
              background: STATUS_BG[st] ?? 'transparent',
              textTransform: 'capitalize',
            }}>
              {st}
            </span>
          )}

          {/* P3 Payment Status Badge: only shown for final invoices when paymentFilter='all' */}
          {isFinal && showPaymentBadge && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
              color: pConfig.color,
              background: pConfig.bg,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: pConfig.dot }} />
              <span>{pConfig.label}</span>
            </span>
          )}

          {isDraft && <DeleteDraftButton invoiceId={inv.id} onDeleted={() => onDeleted(inv.id)} />}
          {loadingEdit === inv.id && <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>Loading…</span>}
        </div>
      </div>

      {/* Row 2: P1 Client Name */}
      <div style={{
        fontSize: 14.5,
        fontWeight: 600,
        color: 'var(--color-text)',
        letterSpacing: '-0.1px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        marginTop: -4,
      }}>
        {inv.client_name ?? '—'}
      </div>

      {/* Row 3: P1 Site Location beside P1 Billing Month (with greater visual prominence) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          flex: 1,
          fontSize: 12.5,
          color: 'var(--color-text-muted)',
        }}>
          {inv.site_location ? (
            <span style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--color-text-muted)',
            }}>
              📍 <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{inv.site_location}</span>
            </span>
          ) : (
            <span style={{ color: 'var(--color-text-faint)', fontStyle: 'italic', fontSize: 12 }}>
              📍 No site specified
            </span>
          )}
        </div>

        {billingMonth && (
          <span style={{
            flexShrink: 0,
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.02em',
            padding: '3px 10px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(200,169,106,0.22) 0%, rgba(200,169,106,0.12) 100%)',
            border: '1px solid rgba(200, 169, 106, 0.55)',
            color: 'var(--color-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 1px 3px rgba(59,42,31,0.06)',
          }}>
            <span style={{ fontSize: 11 }}>🗓️</span>
            <span>{billingMonth}</span>
          </span>
        )}
      </div>

      {/* Financial row (P1 Net Bill & Balance Due) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--color-surface, #FAF8F3)',
        borderRadius: 12,
        padding: '10px 14px',
        border: '1px solid rgba(217, 211, 197, 0.5)',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-faint)' }}>
            Net Bill
          </div>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: isCancelled ? 'var(--color-text-faint)' : 'var(--color-text)',
            fontVariantNumeric: 'tabular-nums',
            marginTop: 2,
          }}>
            ₹{fmt(netReceivable)}
          </div>
        </div>

        {isFinal && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-faint)' }}>
              {balanceDue <= 0.01 ? 'Status' : 'Balance Due'}
            </div>
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              color: balanceDue <= 0.01 ? 'var(--color-success)' : 'var(--color-warning)',
              fontVariantNumeric: 'tabular-nums',
              marginTop: 2,
            }}>
              {balanceDue <= 0.01 ? 'Fully Cleared' : `₹${fmt(balanceDue)}`}
            </div>
          </div>
        )}
      </div>

      {/* Draft: tap to continue editing */}
      {isDraft && (
        <div
          onClick={() => onOpen(inv)}
          role="button"
          tabIndex={0}
          aria-label={`Edit draft invoice ${inv.invoice_number}`}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface, #FAF8F3)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
            transition: 'background 150ms',
          }}
        >
          <span>✏️</span>
          <span>Continue Editing Draft</span>
        </div>
      )}

      {/* Final: Option A Action Toolbar (Hero PDF + Secondary Actions Dock) */}
      {isFinal && (
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* HERO ACTION: View / Download PDF */}
          <InvoiceActions invoiceId={inv.id} invoiceNumber={inv.invoice_number} status={inv.status} />

          {/* SECONDARY ACTIONS DOCK: Dedicated Intentional Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {balanceDue > 0.01 && (
              <button
                type="button"
                onClick={() => onMarkReceived(inv)}
                aria-label={`Record payment for ${inv.invoice_number}`}
                style={{
                  flex: '1 1 auto',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(200, 169, 106, 0.65)',
                  background: 'rgba(200, 169, 106, 0.12)',
                  color: 'var(--color-primary)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 120ms ease',
                  minHeight: 36,
                }}
              >
                <span>💳</span>
                <span>Record Payment</span>
              </button>
            )}

            <button
              type="button"
              disabled={loadingEdit === inv.id}
              onClick={() => onOpen(inv)}
              aria-label={`Edit invoice ${inv.invoice_number}`}
              style={{
                flex: '1 1 auto',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(59,42,31,0.18)',
                background: 'var(--color-surface-2, #FFFFFF)',
                color: 'var(--color-primary)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 150ms',
                opacity: loadingEdit === inv.id ? 0.6 : 1,
                minHeight: 36,
              }}
            >
              <span>✏️</span>
              <span>{loadingEdit === inv.id ? '…' : 'Edit'}</span>
            </button>

            <CancelInvoiceButton invoiceId={inv.id} onCancelled={() => onCancelled(inv.id)} />
          </div>
        </div>
      )}

      {/* Cancelled: PDF only */}
      {isCancelled && (
        <div onClick={e => e.stopPropagation()}>
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

  // Search & filter matching
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const result = fyInvoices.filter(inv => {
      const statusOk  = statusFilter === 'all' || inv.status === statusFilter
      const paymentOk = paymentFilter === 'all' || (inv.status === 'final' && (inv.payment_status ?? 'uncleared') === paymentFilter)
      const searchOk  = !term ||
        (inv.invoice_number ?? '').toLowerCase().includes(term) ||
        (inv.client_name   ?? '').toLowerCase().includes(term) ||
        (inv.project_name  ?? '').toLowerCase().includes(term) ||
        (inv.site_location ?? '').toLowerCase().includes(term) ||
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
        onCancel={() => { setShowWizard(false); setEditDraft(undefined); setEditStatus(undefined); setEditInvoiceId(null); }}
      />
    )
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>
      {/* ─── Apple HIG Frosted Glass Sticky Header ─── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)', margin: 0, fontFamily: 'Playfair Display, Georgia, serif' }}>
              Invoices
            </h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2, fontFamily: 'Work Sans, sans-serif' }}>
              FY {selectedFY} • {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowStatementModal(true)}
              style={{
                background: 'rgba(200,169,106,0.12)',
                color: 'var(--color-primary)',
                border: '1px solid rgba(200,169,106,0.5)',
                borderRadius: 10,
                padding: '7px 13px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Work Sans, sans-serif',
                transition: 'all 150ms ease',
              }}
            >
              Statement
            </button>
            <button
              type="button"
              onClick={() => { setEditDraft(undefined); setEditStatus(undefined); setEditInvoiceId(null); setShowWizard(true) }}
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-bg)',
                border: 'none',
                borderRadius: 10,
                padding: '8px 15px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Work Sans, sans-serif',
                boxShadow: '0 2px 8px rgba(59,42,31,0.2)',
                transition: 'all 150ms ease',
              }}
            >
              + New Invoice
            </button>
          </div>
        </div>

        {/* Search Input with SVG search icon */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search invoice # or client…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px 10px 36px',
              borderRadius: 12,
              border: '1px solid rgba(59,42,31,0.12)',
              background: 'rgba(255, 255, 255, 0.85)',
              color: 'var(--color-text)',
              fontSize: 13,
              fontFamily: 'Work Sans, sans-serif',
              outline: 'none',
              boxShadow: '0 1px 3px rgba(59,42,31,0.03)',
            }}
          />
        </div>

        {/* FY Tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {availableFYs.map(fy => {
            const isSelected = selectedFY === fy
            return (
              <button
                key={fy}
                type="button"
                onClick={() => setSelectedFY(fy)}
                style={{
                  flexShrink: 0,
                  fontSize: 11,
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid rgba(59,42,31,0.12)',
                  background: isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.7)',
                  color: isSelected ? 'var(--color-surface)' : 'var(--color-text-muted)',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: 'Work Sans, sans-serif',
                  boxShadow: isSelected ? '0 1px 4px rgba(59,42,31,0.15)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                FY {fy}
              </button>
            )
          })}
        </div>

        {/* Status Filter Tabs (iOS Segmented Control) */}
        <div style={{
          display: 'flex',
          background: 'rgba(237, 233, 222, 0.75)',
          padding: '3px',
          borderRadius: 12,
          marginTop: 8,
          gap: 3,
        }}>
          {(['final', 'draft', 'cancelled', 'all'] as FilterStatus[]).map(s => {
            const active = statusFilter === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: '5px 0',
                  borderRadius: 9,
                  border: 'none',
                  background: active ? 'var(--color-surface-2, #FFFFFF)' : 'transparent',
                  color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: 'Work Sans, sans-serif',
                  textTransform: 'capitalize',
                  boxShadow: active ? '0 1px 4px rgba(59,42,31,0.08)' : 'none',
                  transition: 'all 180ms ease',
                }}
              >
                {s === 'all' ? 'All' : s}
              </button>
            )
          })}
        </div>

        {/* Payment Sub-filters */}
        {(statusFilter === 'final' || statusFilter === 'all') && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2, alignItems: 'center', scrollbarWidth: 'none' }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Payment:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'uncleared', label: 'Uncleared' },
              { id: 'partially_cleared', label: 'Partial' },
              { id: 'cleared', label: 'Cleared' },
            ].map(p => {
              const active = paymentFilter === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaymentFilter(p.id as PaymentFilter)}
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 16,
                    border: active ? '1px solid rgba(200,169,106,0.8)' : '1px solid rgba(59,42,31,0.1)',
                    background: active ? 'rgba(200, 169, 106, 0.2)' : 'rgba(255,255,255,0.6)',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: 'Work Sans, sans-serif',
                    transition: 'all 150ms ease',
                  }}
                >
                  {p.label}
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
              height: 110, borderRadius: 14,
              background: 'linear-gradient(90deg, var(--color-surface-offset) 25%, var(--color-surface-dynamic, #e6e4df) 50%, var(--color-surface-offset) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-faint)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              No {statusFilter === 'all' ? '' : statusFilter} invoices found for FY {selectedFY}
            </div>
            {invoices.length > 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 360, margin: '0 auto' }}>
                Select another financial year or clear search to view invoices.
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
              showStatusBadge={statusFilter === 'all'}
              showPaymentBadge={paymentFilter === 'all'}
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
