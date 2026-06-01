// Wizard Section 4: Review + Preview PDF + Save Draft / Finalize
// Finalize calls invoicesDb.finalizeInvoice which assigns the
// invoice number at this moment only — never earlier.
import React, { useEffect } from 'react'
import type { InvoiceDraft, InvoiceStatus } from '../../db/types'
import { recomputeTotals } from './useInvoiceDraft'
import { finalizeInvoice } from '../../db/invoicesDb'
import { usePdfPreview } from './pdf/usePdfPreview'

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

// ─── PDF Preview Modal ────────────────────────────────────────────────────────
function PdfPreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 780,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px',
          background: 'var(--color-surface)',
          borderRadius: '10px 10px 0 0',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>
          📄 Invoice Preview
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={url}
            download="invoice.pdf"
            style={{
              padding: '7px 14px', borderRadius: 8,
              background: 'var(--color-primary)',
              color: 'var(--color-bg)',
              fontWeight: 600, fontSize: 13,
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            ⬇ Download
          </a>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 12px', borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              fontWeight: 600, fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 780,
          height: '82vh',
          background: 'white',
          borderRadius: '0 0 10px 10px',
          overflow: 'hidden',
        }}
      >
        <iframe
          src={url}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Invoice PDF Preview"
        />
      </div>
    </div>
  )
}

// ─── Rental items summary ─────────────────────────────────────────────────────
function RentalItemsSummary({ draft }: { draft: InvoiceDraft }) {
  if (draft.rental_items.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-text-faint)', marginBottom: 24 }}>
        No rental items added.
      </p>
    )
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{
        fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10,
      }}>Rental Charges</p>

      {draft.rental_items.map((ri, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '10px 0', borderBottom: '1px solid var(--color-border)',
          fontSize: 13, gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>
              {ri.reg_number || 'Vehicle'}
              {ri.vehicle_type && (
                <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>
                  — {ri.vehicle_type}
                </span>
              )}
            </div>
            <div style={{ color: 'var(--color-text-muted)' }}>
              {ri.billing_mode === 'full_month'
                ? 'Full month rental'
                : `${ri.num_days} day${(ri.num_days ?? 0) !== 1 ? 's' : ''} (₹${fmt(ri.monthly_rent)} ÷ 30 × ${ri.num_days})`
              }
            </div>
          </div>
          <span className="tabular" style={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--color-text)' }}>
            ₹{fmt(ri.subtotal)}
          </span>
        </div>
      ))}

      {draft.item_distribution.length > 0 && (
        <>
          <p style={{
            fontSize: 12, fontWeight: 600, color: 'var(--color-text-faint)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            marginTop: 16, marginBottom: 8,
          }}>Work Order Distribution</p>
          {draft.item_distribution.map((d, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid var(--color-border)',
              fontSize: 13,
            }}>
              <span style={{ flex: 1, color: 'var(--color-text)', paddingRight: 12 }}>
                {d.sub_work_ref && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-faint)', marginRight: 4 }}>[{d.sub_work_ref}]</span>
                )}
                {d.description.slice(0, 45)}{d.description.length > 45 ? '…' : ''}
              </span>
              <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', marginRight: 12 }}>
                {d.allocation_pct.toFixed(1)}%
              </span>
              <span className="tabular" style={{ fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                ₹{fmt(d.allocated_amount)}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Quantity items summary ───────────────────────────────────────────────────
function QuantityItemsSummary({ draft }: { draft: InvoiceDraft }) {
  if (draft.line_items.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-text-faint)', marginBottom: 24 }}>
        No line items added.
      </p>
    )
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{
        fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10,
      }}>Line Items</p>

      {draft.line_items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '10px 0', borderBottom: '1px solid var(--color-border)',
          fontSize: 13, gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>
              {item.sl_no}. {item.description}
            </div>
            <div style={{ color: 'var(--color-text-muted)' }}>
              {item.qty} {item.unit} × ₹{fmt(item.rate)}
            </div>
          </div>
          <span className="tabular" style={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--color-text)' }}>
            ₹{fmt(item.taxable_value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Section4Review component ───────────────────────────────────────────
export default function Section4Review({
  draft,
  patch,
  saving,
  saveDraft,
  onFinalized,
  existingStatus,
  existingInvoiceId,
}: {
  draft: InvoiceDraft
  patch: (updates: Partial<InvoiceDraft>) => void
  saving: boolean
  saveDraft: () => void
  onFinalized: (invoiceNumber: string) => void
  existingStatus?: InvoiceStatus
  // The DB row id of the invoice being edited. Passed to finalizeInvoice
  // so it UPDATEs the existing draft row instead of INSERTing a new one.
  existingInvoiceId?: number | null
}) {
  const [finalizing, setFinalizing] = React.useState(false)
  const [doneNumber, setDoneNumber] = React.useState<string | null>(null)
  const [error, setError]           = React.useState<string | null>(null)
  const [showPdf, setShowPdf]       = React.useState(false)

  // Fix: pass draft to the hook (it captures it internally for PDF generation),
  // and alias the exported names to match what this component uses.
  const { open: generatePdf, loading: generating, pdfUrl } = usePdfPreview(draft)

  // Recompute totals once on mount in case Section 4 is reached without
  // a prior recompute (e.g. editing an existing draft)
  useEffect(() => {
    const updated = recomputeTotals(draft, draft.gst_rate, draft.tds_rate)
    if (updated.total_taxable !== draft.total_taxable ||
        updated.total_gst     !== draft.total_gst ||
        updated.tds_amount    !== draft.tds_amount) {
      patch(updated)
    }
  }, [])

  async function handleFinalize() {
    setFinalizing(true)
    setError(null)
    try {
      const result = await finalizeInvoice(draft, existingInvoiceId, existingStatus)
      if (!result) { setError('Finalization failed. Please try again.'); return }
      patch({ invoice_number: result.invoiceNumber })
      setDoneNumber(result.invoiceNumber)
      setTimeout(() => onFinalized(result.invoiceNumber), 1400)
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error during finalization.')
    } finally {
      setFinalizing(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (doneNumber) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: 16, padding: 32,
      }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <h2 style={{ fontSize: 22, textAlign: 'center' }}>Invoice Finalised!</h2>
        <p style={{ fontSize: 15, color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Invoice <strong>{doneNumber}</strong> has been created.
        </p>
      </div>
    )
  }

  // ── Main review UI ────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px 16px 120px' }}>
      {showPdf && pdfUrl && <PdfPreviewModal url={pdfUrl} onClose={() => setShowPdf(false)} />}

      <h2 style={{ fontSize: 18, marginBottom: 20 }}>Review & Finalise</h2>

      {/* Items summary */}
      {draft.line_item_billing_type === 'rental'
        ? <RentalItemsSummary draft={draft} />
        : <QuantityItemsSummary draft={draft} />
      }

      {/* Financial totals */}
      <div style={{ marginBottom: 28 }}>
        <Row label="Taxable Amount" value={`₹${fmt(draft.total_taxable)}`} />
        <Row label={`GST (${draft.gst_rate}%)`} value={`₹${fmt(draft.total_gst)}`} />
        <Row label="Total Amount" value={`₹${fmt(draft.total_amount)}`} bold />
        {draft.tds_rate > 0 && (
          <Row label={`TDS (${draft.tds_rate}%)`} value={`− ₹${fmt(draft.tds_amount)}`} faint />
        )}
        <Row label="Net Receivable" value={`₹${fmt(draft.net_receivable)}`} bold accent />
        <Row label="Amount in Words" value={draft.amount_in_words} faint />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'var(--color-error-highlight)',
          color: 'var(--color-error)', fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* PDF Preview */}
        <button
          type="button"
          onClick={async () => {
            await generatePdf()
            setShowPdf(true)
          }}
          disabled={generating}
          style={{
            padding: '13px', borderRadius: 12,
            border: '1.5px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-muted)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}
        >
          {generating ? 'Generating PDF…' : '📄 Preview PDF'}
        </button>

        {/* Save Draft */}
        {existingStatus !== 'final' && (
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving}
            style={{
              padding: '13px', borderRadius: 12,
              border: '1.5px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-muted)',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            {saving ? 'Saving…' : '💾 Save Draft'}
          </button>
        )}

        {/* Finalize */}
        <button
          type="button"
          onClick={handleFinalize}
          disabled={finalizing || saving}
          style={{
            padding: '15px', borderRadius: 12,
            border: 'none',
            background: finalizing ? 'var(--color-border)' : 'var(--color-primary)',
            color: finalizing ? 'var(--color-text-muted)' : 'var(--color-bg)',
            fontWeight: 700, fontSize: 16, cursor: finalizing ? 'not-allowed' : 'pointer',
          }}
        >
          {finalizing ? 'Finalising…' : existingStatus === 'final' ? '🔄 Re-finalise Invoice' : '📄 Finalise Invoice'}
        </button>
      </div>
    </div>
  )
}
