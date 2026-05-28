// Wizard Section 4: Review + Save Draft / Finalize
// Finalize calls invoicesDb.finalizeInvoice which assigns the
// invoice number at this moment only — never earlier.
import React, { useEffect } from 'react'
import type { InvoiceDraft, InvoiceStatus } from '../../db/types'
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
        fontSize: bold ? 17 : 14, fontWeight: bold ? 700 : 500,
        color: accent ? 'var(--color-accent)' : faint ? 'var(--color-text-faint)' : 'var(--color-text)',
      }} className="tabular">{value}</span>
    </div>
  )
}

export default function Section4Review({
  draft, patch, saving, saveDraft, onFinalized, existingStatus,
}: {
  draft: InvoiceDraft
  patch: (u: Partial<InvoiceDraft>) => void
  saving: boolean
  saveDraft: () => Promise<void>
  onFinalized: (invoiceNumber: string) => void
  // Pass 'final' when editing an already-finalized invoice so number is never changed
  existingStatus?: InvoiceStatus
}) {
  const [finalizing, setFinalizing] = React.useState(false)
  const [error, setError]           = React.useState<string | null>(null)
  const [doneNumber, setDoneNumber] = React.useState<string | null>(null)

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
      const result = await finalizeInvoice(draft, existingStatus)
      if (!result) throw new Error('Failed to finalize invoice.')
      // Update draft with the real invoice number so Section 1 banner shows it
      patch({ invoice_number: result.invoiceNumber })
      setDoneNumber(result.invoiceNumber)
      setTimeout(() => onFinalized(result.invoiceNumber), 1400)
    } catch (e: any) {
      setError(e.message ?? 'Finalization failed')
    } finally {
      setFinalizing(false)
    }
  }

  const isEditingFinal = existingStatus === 'final'

  if (doneNumber) return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontFamily: 'Playfair Display, serif', marginBottom: 8 }}>
        {isEditingFinal ? 'Invoice Updated!' : 'Invoice Finalized!'}
      </h2>
      <p style={{
        fontFamily: 'monospace', fontSize: 18, fontWeight: 700,
        color: 'var(--color-accent)', marginTop: 8,
      }}>{doneNumber}</p>
    </div>
  )

  return (
    <div style={{ padding: '16px', paddingBottom: 32 }}>

      {/* Finalize notice for already-final invoices */}
      {isEditingFinal && (
        <div style={{
          background: 'var(--color-surface-offset)',
          border: '1px solid var(--color-border)',
          borderRadius: 10, padding: '10px 14px',
          fontSize: 13, color: 'var(--color-text-muted)',
          marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span>🔒</span>
          <span>
            This invoice is already finalized. Invoice number <strong style={{ color: 'var(--color-text)' }}>{draft.invoice_number}</strong> will be preserved.
          </span>
        </div>
      )}

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
        <Row label="Taxable Value" value={`₹${fmt(draft.total_taxable)}`} />
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

      {draft.amount_in_words && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: 24, lineHeight: 1.5 }}>
          {draft.amount_in_words}
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
      )}

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
          {finalizing
            ? 'Finalizing…'
            : isEditingFinal
              ? '💾 Save Changes'
              : '📄 Finalize Invoice'
          }
        </button>
        {!isEditingFinal && (
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
        )}
      </div>
    </div>
  )
}
