// Invoices list page + entry point for the Invoice Wizard
import React, { useEffect, useState } from 'react'
import type { InvoiceWithDetails, InvoiceStatus } from '../../db/types'
import { getInvoices, getInvoiceById, mapInvoiceWithDetailsToDraft, deleteDraftInvoice } from '../../db/invoicesDb'
import type { InvoiceDraft } from '../../db/types'
import InvoiceWizard from './InvoiceWizard'
import { InvoiceActions } from './InvoiceActions'
import { cardStyle } from '../settings/_components'

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'var(--color-warning)',
  final:     'var(--color-success)',
  cancelled: 'var(--color-error)',
}

// ─── Section header ──────────────────────────────────────────────────
function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 10, marginTop: 4,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.8px',
        textTransform: 'uppercase', color: 'var(--color-text-muted)',
      }}>{label}</span>
      <span style={{
        fontSize: 11, fontWeight: 600,
        background: 'var(--color-surface-offset)',
        color: 'var(--color-text-muted)',
        borderRadius: 20, padding: '1px 7px',
      }}>{count}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
    </div>
  )
}

// ─── Delete confirmation inline component ───────────────────────────────
function DeleteDraftButton({ invoiceId, onDeleted }: { invoiceId: number; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()  // don't open the wizard
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    const result = await deleteDraftInvoice(invoiceId)
    setDeleting(false)
    if (result.ok) {
      onDeleted()
    } else {
      alert(result.error ?? 'Delete failed.')
      setConfirming(false)
    }
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation()
    setConfirming(false)
  }

  if (confirming) {
    return (
      <div
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ fontSize: 12, color: 'var(--color-error)', fontWeight: 600 }}>
          Delete draft?
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          style={{
            padding: '4px 10px', borderRadius: 6, border: 'none',
            background: 'var(--color-error)', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {deleting ? '…' : 'Yes, delete'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          style={{
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-muted)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      title="Delete draft"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '4px 6px', borderRadius: 6,
        color: 'var(--color-text-faint)',
        fontSize: 16, lineHeight: 1,
        transition: 'color 150ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-error)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-faint)')}
    >
      🗑️
    </button>
  )
}

export default function InvoicesPage() {
  const [invoices, setInvoices]           = useState<InvoiceWithDetails[]>([])
  const [loading, setLoading]             = useState(true)
  const [showWizard, setShowWizard]       = useState(false)
  const [editDraft, setEditDraft]         = useState<InvoiceDraft | undefined>(undefined)
  const [editStatus, setEditStatus]       = useState<InvoiceStatus | undefined>(undefined)
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null)
  const [loadingEdit, setLoadingEdit]     = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const data = await getInvoices()
    setInvoices(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openInvoice(inv: InvoiceWithDetails) {
    if (inv.status === 'final' || inv.status === 'cancelled') return
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

  // Optimistic removal — remove from local state immediately, then reload
  function handleDraftDeleted(id: number) {
    setInvoices(prev => prev.filter(inv => inv.id !== id))
  }

  const drafts   = invoices.filter(inv => inv.status === 'draft')
  const finals   = invoices.filter(inv => inv.status === 'final')
  const cancelled = invoices.filter(inv => inv.status === 'cancelled')
  const nonDrafts = [...finals, ...cancelled]

  if (showWizard) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          position: 'sticky', top: 0, zIndex: 60,
        }}>
          <button
            type="button"
            onClick={closeWizard}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 20, color: 'var(--color-text-muted)', padding: 0,
            }}
          >←</button>
          <h2 style={{ fontSize: 18, flex: 1 }}>
            {editDraft ? 'Edit Draft Invoice' : 'New Invoice'}
          </h2>
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
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 16px 12px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        position: 'sticky', top: 0, zIndex: 60,
      }}>
        <h1 style={{ fontSize: 22 }}>Invoices</h1>
        <button
          type="button"
          onClick={() => {
            setEditDraft(undefined)
            setEditStatus(undefined)
            setEditInvoiceId(null)
            setShowWizard(true)
          }}
          style={{
            padding: '10px 18px', borderRadius: 12, border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-primary)',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          + New Invoice
        </button>
      </div>

      <div style={{ padding: '16px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-faint)' }}>Loading…</div>
        )}

        {!loading && invoices.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>No invoices yet. Tap "+ New Invoice" to get started.</p>
          </div>
        )}

        {/* ─── DRAFTS SECTION ─── */}
        {!loading && drafts.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel label="Drafts" count={drafts.length} />
            {drafts.map(inv => (
              <div
                key={inv.id}
                style={{
                  ...cardStyle,
                  marginBottom: 10,
                  cursor: 'pointer',
                  opacity: loadingEdit === inv.id ? 0.6 : 1,
                  transition: 'opacity 150ms',
                  // Subtle left accent for drafts
                  borderLeft: '3px solid var(--color-warning)',
                }}
                onClick={() => openInvoice(inv)}
              >
                {/* Top row: number + delete button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 700, color: 'var(--color-warning)' }}>
                    {inv.invoice_number}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {loadingEdit === inv.id && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>Loading…</span>
                    )}
                    <DeleteDraftButton
                      invoiceId={inv.id}
                      onDeleted={() => handleDraftDeleted(inv.id)}
                    />
                  </div>
                </div>

                <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500, marginBottom: 3 }}>
                  {inv.client_name ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  {inv.invoice_date} • {inv.billing_from} → {inv.billing_to}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    {inv.work_order_reference ? `W.O. ${inv.work_order_reference}` : 'No WO linked'}
                  </span>
                  <span className="tabular" style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                    ₹{fmt(inv.total_amount)}
                  </span>
                </div>

                <div style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'var(--color-surface-offset)',
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span>✏️</span>
                  <span>Tap to continue editing</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── FINALISED INVOICES SECTION ─── */}
        {!loading && nonDrafts.length > 0 && (
          <div>
            <SectionLabel label="Finalised Invoices" count={nonDrafts.length} />
            {nonDrafts.map(inv => (
              <div
                key={inv.id}
                style={{
                  ...cardStyle,
                  marginBottom: 10,
                  cursor: 'default',
                  opacity: 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{
                    fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700,
                    color: inv.status === 'cancelled' ? 'var(--color-error)' : 'var(--color-accent)',
                  }}>
                    {inv.invoice_number}
                  </span>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: STATUS_COLORS[inv.status] ?? 'var(--color-border)',
                    color: '#fff', textTransform: 'capitalize',
                  }}>
                    {inv.status}
                  </span>
                </div>

                <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500, marginBottom: 4 }}>
                  {inv.client_name ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  {inv.invoice_date} • {inv.billing_from} → {inv.billing_to}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                    {inv.work_order_reference ? `W.O. ${inv.work_order_reference}` : 'No WO linked'}
                  </span>
                  <span className="tabular" style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                    ₹{fmt(inv.total_amount)}
                  </span>
                </div>

                <div onClick={e => e.stopPropagation()}>
                  <InvoiceActions
                    invoiceId={inv.id}
                    invoiceNumber={inv.invoice_number}
                    status={inv.status}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
