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
      <div onClick={e => e.stopPropagation()} style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-highlight, rgba(139,46,46,0.08))', border: '1px solid var(--color-error)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 12, color: 'var(--color-error)', fontWeight: 600, margin: 0 }}>This will void the invoice and reverse billed quantities.</p>
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
      aria-label="Cancel invoice"
      style={{
        background: 'none',
        border: 'none',
        padding: '2px 0',
        color: 'var(--color-text-faint)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'color 150ms',
        alignSelf: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-faint)' }}
    >
      Void Invoice
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
  const balanceDue    = Number(inv.balance_due ?? netReceivable)

  return (
    <div style={{
      background: 'var(--color-surface, #FAF8F3)',
      borderRadius: 14,
      padding: '16px',
      border: '1px solid var(--color-border)',
      boxShadow: '0 1px 4px rgba(43,31,21,0.04)',
      position: 'relative',
      overflow: 'hidden',
      opacity: loadingEdit === inv.id || isCancelled ? (isCancelled ? 0.72 : 0.6) : 1,
      transition: 'opacity 150ms',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {isCancelled && <VoidStamp />}

      {/* Top Row: Invoice Number, Client, & Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--color-primary)',
            fontFamily: 'Playfair Display, serif',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {inv.invoice_number}
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--color-text-muted)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {inv.client_name ?? '—'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Status Badge */}
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 999,
            color: STATUS_COLOR[st] ?? 'var(--color-text-muted)',
            background: STATUS_BG[st] ?? 'transparent',
            textTransform: 'capitalize',
          }}>
            {st}
          </span>

          {/* Payment Status Badge (Final Invoices Only) */}
          {isFinal && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
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

      {/* Date & Period metadata (clean, no excessive icons) */}
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        <span>{inv.invoice_date}</span>
        {(inv.billing_from || inv.billing_to) && (
          <span> &bull; {inv.billing_from} → {inv.billing_to}</span>
        )}
        {inv.work_order_reference && (
          <span style={{ color: 'var(--color-text-faint)' }}> &bull; WO: {inv.work_order_reference}</span>
        )}
      </div>

      {/* Financial row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--color-surface-offset)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 13,
      }}>
        <div>
          <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>Net Bill: </span>
          <span style={{ fontWeight: 600, color: isCancelled ? 'var(--color-text-faint)' : 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
            ₹{fmt(netReceivable)}
          </span>
        </div>

        {isFinal && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>
              {balanceDue <= 0.01 ? 'Status: ' : 'Due: '}
            </span>
            <span style={{
              fontWeight: 700,
              color: balanceDue <= 0.01 ? 'var(--color-success)' : 'var(--color-warning)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {balanceDue <= 0.01 ? 'Fully Cleared' : `₹${fmt(balanceDue)}`}
            </span>
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
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'transparent',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 150ms',
          }}
        >
          Continue Editing Draft
        </div>
      )}

      {/* Final: Action Toolbar */}
      {isFinal && (
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Mark Received Button (shown if invoice has pending balance) */}
          {balanceDue > 0.01 && (
            <button
              type="button"
              onClick={() => onMarkReceived(inv)}
              aria-label={`Mark received for ${inv.invoice_number}`}
              style={{
                width: '100%',
                padding: '8px 0',
                borderRadius: 8,
                border: '1px solid var(--color-accent)',
                background: 'rgba(200,169,106,0.14)',
                color: 'var(--color-primary)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
            >
              Record Payment &bull; Due: ₹{fmt(balanceDue)}
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
                border: '1px solid var(--color-primary)',
                background: 'transparent',
                color: 'var(--color-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms',
                opacity: loadingEdit === inv.id ? 0.6 : 1,
              }}
            >
              {loadingEdit === inv.id ? '…' : 'Edit'}
            </button>
          </div>

          <CancelInvoiceButton invoiceId={inv.id} onCancelled={() => onCancelled(inv.id)} />
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
      {/* ─── Minimal, Premium Sticky Header ─── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ fontSize: 20, color: 'var(--color-accent)', margin: 0, fontFamily: 'Playfair Display, serif' }}>
            Invoices
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowStatementModal(true)}
              style={{
                background: 'rgba(200,169,106,0.15)',
                color: 'var(--color-accent)',
                border: '1px solid rgba(200,169,106,0.4)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Work Sans, sans-serif',
              }}
            >
              Statement
            </button>
            <button
              type="button"
              onClick={() => { setEditDraft(undefined); setEditStatus(undefined); setEditInvoiceId(null); setShowWizard(true) }}
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-primary)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Work Sans, sans-serif',
                boxShadow: '0 2px 6px rgba(200,169,106,0.25)',
              }}
            >
              + New Invoice
            </button>
          </div>
        </div>

        {/* Search Input */}
        <input
          type="search"
          placeholder="Search invoice # or client…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 12px',
            borderRadius: 8,
            border: '1px solid rgba(200, 169, 106, 0.25)',
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#fff',
            fontSize: 13,
            fontFamily: 'Work Sans, sans-serif',
            outline: 'none',
            marginBottom: 10,
          }}
        />

        {/* FY Tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
          {availableFYs.map(fy => (
            <button
              key={fy}
              type="button"
              onClick={() => setSelectedFY(fy)}
              style={{
                flexShrink: 0,
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 16,
                border: `1px solid ${selectedFY === fy ? 'var(--color-accent)' : 'rgba(255,255,255,0.15)'}`,
                background: selectedFY === fy ? 'var(--color-accent)' : 'transparent',
                color: selectedFY === fy ? 'var(--color-primary)' : 'rgba(255,255,255,0.6)',
                fontWeight: selectedFY === fy ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'Work Sans, sans-serif',
              }}
            >
              FY {fy}
            </button>
          ))}
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
          {(['final', 'draft', 'cancelled', 'all'] as FilterStatus[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{
                flexShrink: 0,
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 16,
                border: `1px solid ${statusFilter === s ? (STATUS_COLOR[s] ?? 'var(--color-accent)') : 'rgba(255,255,255,0.15)'}`,
                background: statusFilter === s ? (STATUS_BG[s] ?? 'rgba(200,169,106,0.15)') : 'transparent',
                color: statusFilter === s ? (STATUS_COLOR[s] ?? 'var(--color-accent)') : 'rgba(255,255,255,0.6)',
                fontWeight: statusFilter === s ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'Work Sans, sans-serif',
                textTransform: 'capitalize',
              }}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {/* Payment Sub-filters */}
        {(statusFilter === 'final' || statusFilter === 'all') && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'uncleared', label: 'Uncleared' },
              { id: 'partially_cleared', label: 'Partial' },
              { id: 'cleared', label: 'Cleared' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaymentFilter(p.id as PaymentFilter)}
                style={{
                  flexShrink: 0,
                  fontSize: 11,
                  padding: '3px 10px',
                  borderRadius: 14,
                  border: `1px solid ${paymentFilter === p.id ? 'var(--color-accent)' : 'rgba(255,255,255,0.12)'}`,
                  background: paymentFilter === p.id ? 'rgba(200, 169, 106, 0.2)' : 'transparent',
                  color: paymentFilter === p.id ? 'var(--color-accent)' : 'rgba(255,255,255,0.5)',
                  fontWeight: paymentFilter === p.id ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'Work Sans, sans-serif',
                }}
              >
                {p.label}
              </button>
            ))}
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
