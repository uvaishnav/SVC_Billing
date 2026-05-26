// Wizard Section 4: Review + Save Draft / Finalize
// All computed values shown read-only.
// Save Draft (any time) or Finalize Invoice.
import React, { useEffect } from 'react'
import type { InvoiceDraft } from '../../db/types'
import { recomputeTotals } from './useInvoiceDraft'
import { finalizeInvoice } from '../../db/invoicesDb'

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function Row({ label, value, bold, accent, faint }: {
  label: string; value: string; bold?: boolean; accent?: boolean; faint?: boolean
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid var(--color-border)',
    }}>
      <span style={{
        fontSize: faint ? 13 : 14,
        color: faint ? 'var(--color-text-faint)' : 'var(--color-text-muted)',
        fontWeight: bold ? 600 : 400,
      }}>{label}</span>
      <span style={{
        fontSize: bold ? 17 : 14,
        fontWeight: bold ? 700 : 500,
        color: accent ? 'var(--color-accent)' : faint ? 'var(--color-text-faint)' : 'var(--color-text)',
      }} className="tabular">{value}</span>
    </div>
  )
}

export default function Section4Review({
  draft, patch, saving, saveDraft, onFinalized,
}: {
  draft: InvoiceDraft
  patch: (u: Partial<InvoiceDraft>) => void
  saving: boolean
  saveDraft: () => Promise<void>
  onFinalized: () => void
}) {
  const [finalizing, setFinalizing] = React.useState(false)
  const [error, setError]           = React.useState<string | null>(null)
  const [done, setDone]             = React.useState(false)

  // Always recompute totals when landing on this section
  useEffect(() => {
    const updated = recomputeTotals(draft, draft.gst_rate, draft.tds_rate)
    if (
      updated.total_taxable !== draft.total_taxable ||
      updated.total_gst     !== draft.total_gst     ||
      updated.total_amount  !== draft.total_amount
    ) {
      patch(updated)
    }
  }, [])

  async function handleFinalize() {
    setFinalizing(true)
    setError(null)
    try {
      const result = await finalizeInvoice(draft)
      if (!result) throw new Error('Failed to finalize invoice.')
      setDone(true)
      setTimeout(onFinalized, 1200)
    } catch (e: any) {
      setError(e.message ?? 'Finalization failed')
    } finally {
      setFinalizing(false)
    }
  }

  if (done) return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h2 style={{ marginBottom: 8 }}>Invoice Finalized!</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>{draft.invoice_number}</p>
    </div>
  )

  return (
    <div style={{ padding: '16px', paddingBottom: 32 }}>

      {/* Line items summary */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Line Items</p>
        {draft.line_items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 0', borderBottom: '1px solid var(--color-border)',
            fontSize: 13,
          }}>
            <span style={{ flex: 1, color: 'var(--color-text)', paddingRight: 12 }}>
              {i + 1}. {item.description.slice(0, 50)}{item.description.length > 50 ? '…' : ''}
            </span>
            <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              {item.qty} {item.unit ?? ''} × ₹{fmt(item.rate)}
            </span>
            <span className="tabular" style={{ fontWeight: 600, minWidth: 80, textAlign: 'right', color: 'var(--color-text)' }}>
              ₹{fmt(item.taxable_value)}
            </span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{ marginBottom: 24 }}>
        <Row label="Taxable Value"          value={`₹${fmt(draft.total_taxable)}`} />
        {draft.tax_mode === 'cgst_sgst' ? (
          <>
            <Row label={`CGST @ ${draft.gst_rate / 2}%`} value={`₹${fmt(draft.total_gst / 2)}`} />
            <Row label={`SGST @ ${draft.gst_rate / 2}%`} value={`₹${fmt(draft.total_gst / 2)}`} />
          </>
        ) : (
          <Row label={`IGST @ ${draft.gst_rate}%`} value={`₹${fmt(draft.total_gst)}`} />
        )}
        <Row label="Total Invoice Amount" value={`₹${fmt(draft.total_amount)}`} bold accent />
        {draft.tds_rate > 0 && (
          <>
            <Row label={`TDS @ ${draft.tds_rate}% (deducted by client)`} value={`₹${fmt(draft.tds_amount)}`} faint />
            <Row label="Net Receivable" value={`₹${fmt(draft.net_receivable)}`} bold />
          </>
        )}
      </div>

      {/* Amount in words */}
      {draft.amount_in_words && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: 24, lineHeight: 1.5 }}>
          {draft.amount_in_words}
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          type="button"
          onClick={handleFinalize}
          disabled={finalizing || saving}
          style={{
            padding: '16px', borderRadius: 12, border: 'none',
            background: finalizing ? 'var(--color-text-faint)' : 'var(--color-primary)',
            color: 'var(--color-bg)', fontWeight: 700, fontSize: 16,
            cursor: finalizing ? 'not-allowed' : 'pointer', width: '100%',
          }}
        >
          {finalizing ? 'Finalizing…' : '📄 Finalize Invoice'}
        </button>
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving || finalizing}
          style={{
            padding: '14px', borderRadius: 12,
            border: '1.5px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-muted)',
            fontWeight: 600, fontSize: 15,
            cursor: 'pointer', width: '100%',
          }}
        >
          {saving ? 'Saving…' : '💾 Save Draft'}
        </button>
      </div>
    </div>
  )
}
