// Invoices list page + entry point for the Invoice Wizard
import React, { useEffect, useState } from 'react'
import type { InvoiceWithDetails, InvoiceStatus } from '../../db/types'
import { getInvoices, getInvoiceById, mapInvoiceWithDetailsToDraft } from '../../db/invoicesDb'
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

export default function InvoicesPage() {
  const [invoices, setInvoices]         = useState<InvoiceWithDetails[]>([])
  const [loading, setLoading]           = useState(true)
  const [showWizard, setShowWizard]     = useState(false)
  const [editDraft, setEditDraft]       = useState<InvoiceDraft | undefined>(undefined)
  const [editStatus, setEditStatus]     = useState<InvoiceStatus | undefined>(undefined)
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null)
  const [loadingEdit, setLoadingEdit]   = useState<number | null>(null)

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
    // Pass the real DB id so the wizard can UPDATE instead of INSERT
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

      <div style={{ padding: '12px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-faint)' }}>Loading…</div>
        )}

        {!loading && invoices.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>No invoices yet. Tap "+ New Invoice" to get started.</p>
          </div>
        )}

        {invoices.map(inv => (
          <div
            key={inv.id}
            style={{
              ...cardStyle,
              marginBottom: 12,
              cursor: inv.status === 'draft' ? 'pointer' : 'default',
              opacity: loadingEdit === inv.id ? 0.6 : 1,
              transition: 'opacity 150ms',
            }}
            onClick={() => openInvoice(inv)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: 'var(--color-accent)' }}>
                {inv.invoice_number}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {loadingEdit === inv.id && (
                  <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>Loading…</span>
                )}
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: STATUS_COLORS[inv.status] ?? 'var(--color-border)',
                  color: '#fff',
                  textTransform: 'capitalize',
                }}>
                  {inv.status}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500, marginBottom: 4 }}>
              {inv.client_name ?? '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              {inv.invoice_date} • {inv.billing_from} → {inv.billing_to}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: inv.status === 'draft' ? 0 : 10 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                {inv.work_order_reference ? `W.O. ${inv.work_order_reference}` : 'No WO linked'}
              </span>
              <span className="tabular" style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                ₹{fmt(inv.total_amount)}
              </span>
            </div>

            {inv.status === 'draft' && (
              <div style={{
                marginTop: 10,
                padding: '7px 12px',
                borderRadius: 8,
                background: 'var(--color-surface-offset)',
                fontSize: 12,
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span>✏️</span>
                <span>Tap to continue editing this draft</span>
              </div>
            )}

            {inv.status !== 'draft' && (
              <div onClick={e => e.stopPropagation()}>
                <InvoiceActions
                  invoiceId={inv.id}
                  invoiceNumber={inv.invoice_number}
                  status={inv.status}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
