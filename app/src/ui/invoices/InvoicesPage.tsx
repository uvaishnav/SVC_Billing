import React, { useEffect, useState } from 'react'
import type { InvoiceWithDetails } from '../../db/types'
import { getInvoices } from '../../db/invoicesDb'
import InvoiceWizard from './InvoiceWizard'

const STATUS_COLORS: Record<string, string> = {
  draft:     '#f59e0b',
  final:     '#22c55e',
  cancelled: '#dc503c',
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function InvoicesPage() {
  const [invoices, setInvoices]       = useState<InvoiceWithDetails[]>([])
  const [loading, setLoading]         = useState(true)
  const [showWizard, setShowWizard]   = useState(false)

  async function reload() {
    setLoading(true)
    const data = await getInvoices()
    setInvoices(data)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  if (showWizard) {
    return (
      <InvoiceWizard
        onClose={() => setShowWizard(false)}
        onFinalized={() => { setShowWizard(false); reload() }}
      />
    )
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif' }}>
          Invoices
        </h2>
        <button
          onClick={() => setShowWizard(true)}
          style={{
            padding: '10px 18px',
            background: 'var(--color-accent)',
            color: 'var(--color-primary)',
            border: 'none', borderRadius: '10px',
            fontSize: '14px', fontWeight: 700,
            fontFamily: 'Work Sans, sans-serif',
            cursor: 'pointer',
          }}
        >
          + New Invoice
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-faint)', padding: '48px', fontFamily: 'Work Sans, sans-serif' }}>
          Loading invoices…
        </div>
      ) : invoices.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-faint)', padding: '48px', fontFamily: 'Work Sans, sans-serif' }}>
          No invoices yet. Tap “+ New Invoice” to create your first one.
        </div>
      ) : (
        invoices.map(inv => (
          <div key={inv.id} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(200,169,106,0.15)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif' }}>
                {inv.invoice_number}
              </span>
              <span style={{
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '11px', fontWeight: 700,
                background: `${STATUS_COLORS[inv.status]}22`,
                color: STATUS_COLORS[inv.status],
                fontFamily: 'Work Sans, sans-serif',
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {inv.status}
              </span>
            </div>

            {/* Client */}
            <div style={{ fontSize: '13px', color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif' }}>
              {inv.client_name ?? 'No client'}
              {inv.work_order_reference && (
                <span style={{ marginLeft: '8px', color: 'rgba(200,169,106,0.6)', fontSize: '12px' }}>
                  W.O. {inv.work_order_reference}
                </span>
              )}
            </div>

            {/* Dates */}
            <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif' }}>
              {inv.invoice_date} • Period: {inv.billing_from} → {inv.billing_to}
            </div>

            {/* Amount */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif' }}>
                {inv.line_items.length} item{inv.line_items.length !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'Work Sans, sans-serif' }}>
                {fmt(inv.total_amount)}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
