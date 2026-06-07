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

      {/* Amount row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isFinal || isCancelled ? 12 : 0 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>Total</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: isCancelled ? 'var(--color-text-faint)' : 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
          ₹{fmt(inv.total_amount)}
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
      const searchOk = !search ||
        inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        (inv.client_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.work_order_reference ?? '').toLowerCase().includes(search.toLowerCase())
      return fyOk && statusOk && searchOk
    })
    return sortByNumberDesc(result)
  }, [invoices, selectedFY, statusFilter, search])

  async function openInvoice(inv: InvoiceWithDetails) {
    if (inv.status === 'cancelled') return
    setLoadingEdit(inv.id)
    const full = await getInvoiceById(inv.id)
    setLoadingEdit(null)
    if (!full) return
    const draft = await mapInvoiceWithDetailsToDraft(full)
    setEditDraft(draft)
    setEditStatus(inv.status)
    setEditInvoiceId(inv.id)
    setShowWizard(true)
  }

  function closeWizard() {
    setShowWizard(false)
    setEditDraft(undefined)
    setEditStatus(undefined)
    setEditInvoiceId(null)
    load()
  }

  function handleDraftDeleted(id: number) {
    setInvoices(prev => prev.filter(inv => inv.id !== id))
  }

  function handleInvoiceCancelled(id: number) {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'cancelled' as InvoiceStatus } : inv))
    setStatusFilter('cancelled')
  }

  const counts = useMemo(() => {
    const base = invoices.filter(inv => {
      const isDraft = inv.status === 'draft'
      return isDraft ? selectedFY === currentFY() : getFY(inv.invoice_date) === selectedFY
    })
    return {
      final:     base.filter(i => i.status === 'final').length,
      draft:     base.filter(i => i.status === 'draft').length,
      cancelled: base.filter(i => i.status === 'cancelled').length,
      all:       base.length,
    }
  }, [invoices, selectedFY])

  const statusFilters: { id: FilterStatus; label: string }[] = [
    { id: 'final',     label: 'Finalised' },
    { id: 'draft',     label: 'Drafts'    },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'all',       label: 'All'       },
  ]

  if (showWizard) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>
        <div style={{
          background: 'var(--color-primary)',
          paddingTop: 'calc(20px + var(--safe-top, 0px))',
          paddingRight: '16px',
          paddingBottom: '14px',
          paddingLeft: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 60,
        }}>
          <button type="button" onClick={closeWizard}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, color: '#fff', width: 44, height: 44, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            aria-label="Back to invoices"
          >←</button>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{editStatus === 'final' ? 'Edit Finalised' : editDraft ? 'Edit Draft' : 'New Invoice'}</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: 'Playfair Display, serif' }}>
              {editStatus === 'final' ? 'Edit Invoice' : editDraft ? 'Draft Invoice' : 'Create Invoice'}
            </div>
          </div>
        </div>
        <InvoiceWizard
          initialDraft={editDraft}
          existingStatus={editStatus}
          existingInvoiceId={editInvoiceId}
          onComplete={closeWizard}
          onSaveDraft={() => load()}
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      {/* Sticky header — safe-area aware */}
      <div style={{
        background: 'var(--color-primary)',
        paddingTop: 'calc(20px + var(--safe-top, 0px))',
        paddingRight: '20px',
        paddingBottom: 0,
        paddingLeft: '20px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        {/* Title + add */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ color: 'var(--color-bg)', fontSize: 22, fontFamily: 'Playfair Display, serif', marginBottom: 2 }}>Invoices</h1>
            <p style={{ color: 'var(--color-accent)', fontSize: 13, opacity: 0.85 }}>FY {selectedFY} &bull; {counts.final} finalised</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditDraft(undefined); setEditStatus(undefined); setEditInvoiceId(null); setShowWizard(true) }}
            aria-label="Create invoice"
            style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-accent)', color: 'var(--color-primary)', fontSize: 24, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', flexShrink: 0 }}
          >+</button>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search invoice no, client, work order…"
          aria-label="Search invoices"
          style={{ width: '100%', padding: '11px 16px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.12)', color: 'var(--color-bg)', fontSize: 15, outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box', marginBottom: 10 }}
        />

        {/* FY pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 8, scrollbarWidth: 'none' }}>
          {availableFYs.map(fy => (
            <button key={fy} type="button" onClick={() => setSelectedFY(fy)}
              aria-pressed={selectedFY === fy}
              aria-label={`Financial year ${fy}`}
              style={{
                padding: '5px 14px', borderRadius: 20, flexShrink: 0,
                border: selectedFY === fy ? 'none' : '1px solid rgba(255,255,255,0.25)',
                background: selectedFY === fy ? 'rgba(255,255,255,0.22)' : 'transparent',
                color: selectedFY === fy ? '#fff' : 'rgba(255,255,255,0.65)',
                fontSize: 13, fontWeight: selectedFY === fy ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>FY {fy}</button>
          ))}
        </div>

        {/* Status filter pills */}
        <div role="group" aria-label="Filter by status" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 14, scrollbarWidth: 'none' }}>
          {statusFilters.map(f => {
            const active = statusFilter === f.id
            const count  = counts[f.id]
            return (
              <button key={f.id} type="button" onClick={() => setStatusFilter(f.id)}
                aria-pressed={active}
                aria-label={`${f.label} (${count})`}
                style={{
                  padding: '6px 14px', borderRadius: 20, flexShrink: 0,
                  border: active ? 'none' : '1px solid rgba(255,255,255,0.2)',
                  background: active ? 'var(--color-accent)' : 'transparent',
                  color: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.7)',
                  fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                }}>
                {f.label}
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: active ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)',
                  color: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.85)',
                  borderRadius: 20, padding: '1px 6px', minWidth: 18, textAlign: 'center' as const,
                }}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center' as const, padding: '60px 0', color: 'var(--color-text-muted)', fontSize: 15 }}>Loading invoices…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center' as const, padding: '60px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-surface-offset)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>📄</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>
              {search
                ? `No invoices matching "${search}"`
                : statusFilter === 'all'
                  ? `No invoices for FY ${selectedFY}.`
                  : `No ${statusFilter} invoices for FY ${selectedFY}.`}
            </p>
            {!search && statusFilter === 'final' && (
              <p style={{ color: 'var(--color-text-faint)', fontSize: 13, marginTop: 6 }}>Tap + to create a new invoice.</p>
            )}
          </div>
        ) : (
          <>
            <p style={{ ...sectionTitleStyle, marginBottom: 14 }}>
              {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} &bull; FY {selectedFY}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(inv => (
                <InvoiceCard
                  key={inv.id}
                  inv={inv}
                  onOpen={openInvoice}
                  onDeleted={handleDraftDeleted}
                  onCancelled={handleInvoiceCancelled}
                  loadingEdit={loadingEdit}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
