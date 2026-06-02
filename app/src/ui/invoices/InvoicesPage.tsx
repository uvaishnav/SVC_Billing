import { useEffect, useMemo, useState } from 'react'
import type { InvoiceWithRelations } from '../../db/types'
import { getInvoices, markInvoicePaid, cancelInvoice } from '../../db/invoicesDb'
import { sectionTitleStyle } from '../settings/_components'
import InvoiceCard from './InvoiceCard'
import InvoiceFormModal from './InvoiceFormModal'
import { InvoicePreviewModal } from './pdf/InvoicePreviewModal'

type FilterId = 'all' | 'draft' | 'sent' | 'paid' | 'cancelled'

function InvoiceDetailSheet({ invoice, onClose, onEdit, onPreview }: {
  invoice: InvoiceWithRelations
  onClose: () => void
  onEdit: () => void
  onPreview: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,14,8,0.45)', zIndex: 200, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          marginTop: 'auto',
          width: '100%',
          maxWidth: '720px',
          background: 'var(--color-bg)',
          borderTopLeftRadius: '22px',
          borderTopRightRadius: '22px',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.2)',
          maxHeight: '92vh',
          overflow: 'auto',
        }}
      >
        <div style={{ width: '44px', height: '5px', borderRadius: '3px', background: 'var(--color-border)', margin: '10px auto 8px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 'calc(var(--safe-top, 0px) + 16px)', paddingRight: '16px', paddingBottom: '12px', paddingLeft: '16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', position: 'sticky', top: 0, zIndex: 60 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '2px' }}>Invoice</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Playfair Display, serif' }}>{invoice.invoice_number}</div>
          </div>
          <button onClick={onPreview} style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', fontWeight: 600 }}>Preview</button>
          <button onClick={onEdit} style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
          <button onClick={onClose} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>

        <div style={{ padding: '18px 16px 24px', display: 'grid', gap: '14px' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '14px 16px', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '6px' }}>Client</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>{invoice.client_name}</div>
            {invoice.project_name && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{invoice.project_name}</div>}
          </div>

          <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '14px 16px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '6px' }}>Issue Date</div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{invoice.invoice_date}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '6px' }}>Due Date</div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{invoice.due_date || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '6px' }}>Status</div>
                <div style={{ fontSize: '15px', fontWeight: 600, textTransform: 'capitalize' }}>{invoice.status}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '6px' }}>Total</div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>₹ {Number(invoice.grand_total).toFixed(2)}</div>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '14px 16px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '6px' }}>Notes</div>
              <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{invoice.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function InvoicesPage() {
  const [invoices,       setInvoices]       = useState<InvoiceWithRelations[]>([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [filter,         setFilter]         = useState<FilterId>('all')
  const [modalOpen,      setModalOpen]      = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithRelations | null>(null)
  const [detailInvoice,  setDetailInvoice]  = useState<InvoiceWithRelations | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceWithRelations | null>(null)

  const load = async () => {
    setLoading(true)
    const data = await getInvoices()
    setInvoices(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch =
        inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        (inv.client_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.project_name ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesFilter = filter === 'all' || inv.status === filter
      return matchesSearch && matchesFilter
    })
  }, [invoices, search, filter])

  async function handleMarkPaid(id: number) {
    await markInvoicePaid(id)
    load()
  }

  async function handleCancel(id: number) {
    if (!confirm('Cancel this invoice?')) return
    await cancelInvoice(id)
    load()
  }

  function handleEdit(invoice: InvoiceWithRelations) {
    setEditingInvoice(invoice)
    setModalOpen(true)
  }

  function handleAdd() {
    setEditingInvoice(null)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingInvoice(null)
    load()
  }

  const filters: { id: FilterId; label: string }[] = [
    { id: 'all',       label: 'All' },
    { id: 'draft',     label: 'Draft' },
    { id: 'sent',      label: 'Sent' },
    { id: 'paid',      label: 'Paid' },
    { id: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>
      <div className="page-header" style={{ background: 'var(--color-primary)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h1 style={{ color: 'var(--color-bg)', fontSize: '22px', fontFamily: 'Playfair Display, serif', marginBottom: '2px' }}>Invoices</h1>
            <p style={{ color: 'var(--color-accent)', fontSize: '13px', opacity: 0.85 }}>
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleAdd}
            style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-accent)', color: 'var(--color-primary)', fontSize: '24px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', flexShrink: 0 }}
          >+</button>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by invoice no, client, or project…"
          style={{ width: '100%', padding: '11px 16px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'var(--color-bg)', fontSize: '15px', outline: 'none', fontFamily: 'Work Sans, sans-serif', boxSizing: 'border-box', marginBottom: '12px' }}
        />

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px' }}>
          {filters.map(f => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '8px 12px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: active ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
                  color: active ? 'var(--color-primary)' : 'var(--color-bg)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Work Sans, sans-serif',
                  flexShrink: 0,
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: '15px' }}>Loading invoices…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface-offset)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>🧾</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
              {search ? `No invoices matching "${search}"` : 'No invoices yet.'}
            </p>
            {!search && <p style={{ color: 'var(--color-text-faint)', fontSize: '13px', marginTop: '6px' }}>Tap + to create your first invoice.</p>}
          </div>
        ) : (
          <>
            <p style={{ ...sectionTitleStyle, marginBottom: '14px' }}>
              {search || filter !== 'all' ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'All Invoices'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map(inv => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  onView={setDetailInvoice}
                  onEdit={handleEdit}
                  onMarkPaid={handleMarkPaid}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <InvoiceFormModal
          invoice={editingInvoice}
          onClose={() => { setModalOpen(false); setEditingInvoice(null) }}
          onSaved={handleSaved}
        />
      )}

      {detailInvoice && (
        <InvoiceDetailSheet
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
          onEdit={() => {
            setDetailInvoice(null)
            handleEdit(detailInvoice)
          }}
          onPreview={() => {
            setPreviewInvoice(detailInvoice)
          }}
        />
      )}

      {previewInvoice && (
        <InvoicePreviewModal
          invoiceId={previewInvoice.id}
          invoiceNumber={previewInvoice.invoice_number}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
    </div>
  )
}
