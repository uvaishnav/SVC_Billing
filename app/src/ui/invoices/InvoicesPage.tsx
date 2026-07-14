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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
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
  inv, onOpen, onDeleted, onCancelled, loadingEdit,
}: {
  inv: InvoiceWithDetails
  onOpen: (inv: InvoiceWithDetails) => void
  onDeleted: (id: number) => void
  onCancelled: (id: number) => void
  loadingEdit: number | null
}) {
  const isDraft     = inv.status === 'draft'
  const isFinal     = inv.status === 'final'
  const isCancelled = inv.status === 'cancelled'
  const st          = inv.status ?? 'draft'

  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 14,
      padding: '14px 16px',
      border: '1px solid rgba(217,211,197,0.45)',
      boxShadow: '0 1px 3px rgba(43,31,21,0.05), 0 4px 14px rgba(43,31,21,0.03)',
      position: 'relative',
      overflow: 'hidden',
      opacity: loadingEdit === inv.id || isCancelled ? (isCancelled ? 0.72 : 0.6) : 1,
      transition: 'opacity 150ms',
    }}>
      {isCancelled && <VoidStamp />}

      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Playfair Display, serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {inv.invoice_number}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {inv.client_name ?? '—'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '4px 10px',
            borderRadius: 999,
            color: STATUS_COLOR[st] ?? 'var(--color-text-muted)',
            background: STATUS_BG[st] ?? 'transparent',
            textTransform: 'capitalize',
          }}>{st}</span>
          {isDraft && <DeleteDraftButton invoiceId={inv.id} onDeleted={() => onDeleted(inv.id)} />}
          {loadingEdit === inv.id && <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>Loading…</span>}
        </div>
      </div>

      {/* Date + period row */}
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
        {inv.invoice_date} &bull; {inv.billing_from} → {inv.billing_to}
        {inv.work_order_reference && (
          <span style={{ marginLeft: 6, color: 'var(--color-text-faint)' }}>· W.O. {inv.work_order_reference}</span>
        )}
      </div>

      {/* Amount row — shows net receivable (after TDS) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isFinal || isCancelled ? 12 : 0 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>Net Receivable</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: isCancelled ? 'var(--color-text-faint)' : 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
          ₹{fmt(inv.net_receivable)}
        </span>
      </div>

      {/* Draft: tap to edit */}
      {isDraft && (
        <div
          onClick={() => onOpen(inv)}
          role="button"
          tabIndex={0}
          aria-label={`Edit draft invoice ${inv.invoice_number}`}
          style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--color-surface-offset)', fontSize: 13, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
        >
          <span>✏️</span><span>Tap to continue editing</span>
        </div>
      )}

      {/* Final: PDF + Edit + Cancel */}
      {isFinal && (
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <InvoiceActions invoiceId={inv.id} invoiceNumber={inv.invoice_number} status={inv.status} />
            </div>
            <button
              type="button"
              disabled={loadingEdit === inv.id}
              onClick={() => onOpen(inv)}
              aria-label={`Edit invoice ${inv.invoice_number}`}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 150ms, color 150ms', opacity: loadingEdit === inv.id ? 0.6 : 1 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-primary)' }}
            >{loadingEdit === inv.id ? 'Loading…' : '✏️ Edit'}</button>
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

export default function InvoicesPage() {
  const [invoices,      setInvoices]      = useState<InvoiceWithDetails[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [selectedFY,    setSelectedFY]    = useState<string>(currentFY())
  const [statusFilter,  setStatusFilter]  = useState<FilterStatus>('final')
  const [showWizard,    setShowWizard]    = useState(false)
  const [editDraft,     setEditDraft]     = useState<InvoiceDraft | undefined>(undefined)
  const [editStatus,    setEditStatus]    = useState<InvoiceStatus | undefined>(undefined)
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null)
  const [loadingEdit,   setLoadingEdit]   = useState<number | null>(null)

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

  const filtered = useMemo(() => {
    const result = invoices.filter(inv => {
      const isDraft  = inv.status === 'draft'
      const fyOk     = isDraft ? selectedFY === currentFY() : getFY(inv.invoice_date) === selectedFY
      const statusOk = statusFilter === 'all' || inv.status === statusFilter
      const searchOk = !search.trim() ||
        (inv.invoice_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.client_name   ?? '').toLowerCase().includes(search.toLowerCase())
      return fyOk && statusOk && searchOk
    })
    return sortByNumberDesc(result)
  }, [invoices, selectedFY, statusFilter, search])

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
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>
      {/* ─── Sticky header ─── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ fontSize: 20, color: 'var(--color-accent)', margin: 0, fontFamily: 'Playfair Display, serif' }}>Invoices</h1>
          <button
            type="button"
            onClick={() => { setEditDraft(undefined); setEditStatus(undefined); setEditInvoiceId(null); setShowWizard(true) }}
            style={{
              background: 'var(--color-accent)', color: 'var(--color-primary)',
              border: 'none', borderRadius: 10, padding: '9px 16px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Work Sans, sans-serif',
              boxShadow: '0 2px 8px rgba(200,169,106,0.25)',
              minHeight: 38,
            }}
          >+ New Invoice</button>
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Search invoice # or client…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '9px 12px', borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-offset)',
            color: 'var(--color-text)', fontSize: 14,
            fontFamily: 'Work Sans, sans-serif',
            outline: 'none', marginBottom: 10,
          }}
        />

        {/* FY tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {availableFYs.map(fy => (
            <button key={fy} type="button" onClick={() => setSelectedFY(fy)} style={{
              flexShrink: 0, fontSize: 12, padding: '5px 14px', borderRadius: 20, minHeight: 30,
              border: '1px solid var(--color-border)',
              background: selectedFY === fy ? 'var(--color-accent)' : 'transparent',
              color: selectedFY === fy ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: selectedFY === fy ? 600 : 400, cursor: 'pointer',
              fontFamily: 'Work Sans, sans-serif',
              transition: 'background 180ms, color 180ms',
            }}>FY {fy}</button>
          ))}
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {(['final', 'draft', 'cancelled', 'all'] as FilterStatus[]).map(s => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)} style={{
              flexShrink: 0, fontSize: 12, padding: '5px 14px', borderRadius: 20, minHeight: 30,
              border: `1px solid ${
                statusFilter === s
                  ? (STATUS_COLOR[s] ?? 'var(--color-accent)')
                  : 'var(--color-border)'
              }`,
              background: statusFilter === s
                ? (STATUS_BG[s] ?? 'rgba(200,169,106,0.12)')
                : 'transparent',
              color: statusFilter === s
                ? (STATUS_COLOR[s] ?? 'var(--color-primary)')
                : 'var(--color-text-muted)',
              fontWeight: statusFilter === s ? 600 : 400, cursor: 'pointer',
              fontFamily: 'Work Sans, sans-serif',
              textTransform: 'capitalize',
              transition: 'all 180ms',
            }}>{s === 'all' ? 'All' : s}</button>
          ))}
        </div>
      </div>

      {/* ─── List ─── */}
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
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-faint)', fontSize: 14 }}>
            No invoices found
          </div>
        ) : (
          filtered.map(inv => (
            <InvoiceCard
              key={inv.id}
              inv={inv}
              onOpen={handleOpen}
              onDeleted={handleDeleted}
              onCancelled={handleCancelled}
              loadingEdit={loadingEdit}
            />
          ))
        )}
      </div>
    </div>
  )
}
