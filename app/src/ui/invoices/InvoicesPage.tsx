// Invoices list page + entry point for the Invoice Wizard
import React, { useEffect, useState } from 'react'
import type { InvoiceWithDetails } from '../../db/types'
import { getInvoices } from '../../db/invoicesDb'
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
  const [invoices, setInvoices]     = useState<InvoiceWithDetails[]>([])
  const [loading, setLoading]       = useState(true)
  const [showWizard, setShowWizard] = useState(false)

  async function load() {
    setLoading(true)
    const data = await getInvoices()
    setInvoices(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (showWizard) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          position: 'sticky', top: 0, zIndex: 60,
        }}>
          <button
            type="button"
            onClick={() => { setShowWizard(false); load() }}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 20, color: 'var(--color-text-muted)', padding: 0,
            }}
          >←</button>
          <h2 style={{ fontSize: 18, flex: 1 }}>New Invoice</h2>
        </div>
        <InvoiceWizard
          onComplete={() => { setShowWizard(false); load() }}
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
          onClick={() => setShowWizard(true)}
          style={{
            padding: '10px 18px', borderRadius: 12, border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-primary)',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          + New Invoice
        </button>
      </div>

      {/* List */}
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
          <div key={inv.id} style={{ ...cardStyle, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: 'var(--color-accent)' }}>
                {inv.invoice_number}
              </span>
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: STATUS_COLORS[inv.status] ?? 'var(--color-border)',
                color: '#fff',
                textTransform: 'capitalize',
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
            {/* PDF action — only shows for final/cancelled invoices */}
            <InvoiceActions
              invoiceId={inv.id}
              invoiceNumber={inv.invoice_number}
              status={inv.status}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
