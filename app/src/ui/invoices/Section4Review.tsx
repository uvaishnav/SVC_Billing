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
  // Close on Escape key
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
      {/* Header bar */}
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

      {/* iframe */}
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
  )
}

// ─── TDS editable row ─────────────────────────────────────────────────────────
// FIX (Bug A): TDS must be calculated on taxable value only, NOT on total_amount.
// The prop was renamed from `totalAmount` → `taxableAmount` and the call site
// now passes `draft.total_taxable` so the live preview is always correct.
// net_receivable preview = total_amount - tds_amount (TDS is deducted from the
// full invoice amount, but it is *calculated* on the taxable portion only).
function TdsRow({
  tdsRate, taxableAmount, totalAmount, onTdsRateChange,
}: {
  tdsRate: number
  taxableAmount: number   // ← total_taxable (base for TDS calculation)
  totalAmount: number     // ← total_amount  (base for net_receivable display)
  onTdsRateChange: (rate: number) => void
}) {
  // TDS is calculated on taxable value only (not on GST-inclusive total)
  const tdsAmount     = Math.round((taxableAmount * tdsRate) / 100 * 100) / 100
  const netReceivable = totalAmount - tdsAmount
  const [editing, setEditing] = React.useState(false)
  const [inputVal, setInputVal] = React.useState(String(tdsRate))

  // Keep local input in sync when tdsRate changes from outside (e.g. WO selection)
  React.useEffect(() => {
    if (!editing) setInputVal(String(tdsRate))
  }, [tdsRate, editing])

  function commitEdit() {
    const parsed = parseFloat(inputVal)
    const clamped = isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 30)
    onTdsRateChange(Math.round(clamped * 100) / 100)
    setEditing(false)
  }

  return (
    <>
      {/* TDS rate row — always visible, tap rate to edit */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 0', borderBottom: '1px solid var(--color-border)',
      }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-faint)' }}>
          TDS deducted by client
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                autoFocus
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
                style={{
                  width: 64, padding: '4px 8px', borderRadius: 6,
                  border: '1.5px solid var(--color-primary)',
                  background: 'var(--color-surface)',
                  fontSize: 14, fontWeight: 600,
                  color: 'var(--color-text)', textAlign: 'right',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-faint)' }}>%</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setInputVal(String(tdsRate)); setEditing(true) }}
              title="Tap to edit TDS rate"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: tdsRate > 0 ? 'var(--color-primary-highlight)' : 'var(--color-surface-offset)',
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: tdsRate > 0 ? 'var(--color-primary)' : 'var(--color-text-faint)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {tdsRate}%
              </span>
              <span style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>✏️</span>
            </button>
          )}
          <span style={{
            fontSize: 14, fontWeight: 500,
            color: tdsRate > 0 ? 'var(--color-text)' : 'var(--color-text-faint)',
            fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right',
          }}>
            {tdsRate > 0 ? `− ₹${fmt(tdsAmount)}` : '—'}
          </span>
        </div>
      </div>

      {/* Net receivable — only show when TDS > 0 */}
      {tdsRate > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 0', borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 }}>Net Receivable</span>
          <span style={{
            fontSize: 17, fontWeight: 700, color: 'var(--color-text)',
            fontVariantNumeric: 'tabular-nums',
          }}>₹{fmt(netReceivable)}</span>
        </div>
      )}
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Section4Review({
  draft, patch, saving, saveDraft, onFinalized, existingStatus,
}: {
  draft: InvoiceDraft
  patch: (u: Partial<InvoiceDraft>) => void
  saving: boolean
  saveDraft: () => Promise<void>
  onFinalized: (invoiceNumber: string) => void
  existingStatus?: InvoiceStatus
}) {
  const [finalizing, setFinalizing] = React.useState(false)
  const [error, setError]           = React.useState<string | null>(null)
  const [doneNumber, setDoneNumber] = React.useState<string | null>(null)

  const { open: openPreview, close: closePreview, pdfUrl, loading: pdfLoading, error: pdfError } = usePdfPreview(draft)

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

  // When TDS rate is edited inline, recompute tds_amount and net_receivable.
  function handleTdsRateChange(newRate: number) {
    const updated = recomputeTotals({ ...draft, tds_rate: newRate }, draft.gst_rate, newRate)
    patch(updated)
  }

  async function handleFinalize() {
    setFinalizing(true)
    setError(null)
    try {
      const result = await finalizeInvoice(draft, existingStatus)
      if (!result) throw new Error('Failed to finalize invoice.')
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

      {/* PDF Preview Modal */}
      {pdfUrl && <PdfPreviewModal url={pdfUrl} onClose={closePreview} />}

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
            This invoice is already finalized. Invoice number{' '}
            <strong style={{ color: 'var(--color-text)' }}>{draft.invoice_number}</strong>{' '}
            will be preserved.
          </span>
        </div>
      )}

      {/* Billing type badge */}
      <div style={{ marginBottom: 16 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 20,
          fontSize: 12, fontWeight: 700,
          background: draft.line_item_billing_type === 'rental'
            ? 'var(--color-primary-highlight)'
            : 'var(--color-surface-offset)',
          color: draft.line_item_billing_type === 'rental'
            ? 'var(--color-primary)'
            : 'var(--color-text-muted)',
          border: `1px solid ${
            draft.line_item_billing_type === 'rental'
              ? 'var(--color-primary)'
              : 'var(--color-border)'
          }`,
        }}>
          {draft.line_item_billing_type === 'rental' ? '🚛 Monthly Rental' : '📦 Per Quantity'}
        </span>
      </div>

      {/* Items summary — branches on billing type */}
      {draft.line_item_billing_type === 'rental'
        ? <RentalItemsSummary draft={draft} />
        : <QuantityItemsSummary draft={draft} />
      }

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

        {/* FIX (Bug A): taxableAmount={draft.total_taxable} ensures TDS preview
            is computed on the correct base (taxable value only, before GST).
            totalAmount={draft.total_amount} is still needed for net_receivable display. */}
        <TdsRow
          tdsRate={draft.tds_rate}
          taxableAmount={draft.total_taxable}
          totalAmount={draft.total_amount}
          onTdsRateChange={handleTdsRateChange}
        />
      </div>

      {draft.amount_in_words && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: 24, lineHeight: 1.5 }}>
          {draft.amount_in_words}
        </div>
      )}

      {/* PDF error */}
      {pdfError && (
        <div style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 12 }}>⚠️ PDF Error: {pdfError}</div>
      )}

      {error && (
        <div style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Preview PDF button — always visible in Section 4 */}
        <button
          type="button"
          onClick={openPreview}
          disabled={pdfLoading || finalizing || saving}
          style={{
            padding: '14px', borderRadius: 12,
            border: '1.5px solid var(--color-primary)',
            background: 'transparent',
            color: pdfLoading ? 'var(--color-text-faint)' : 'var(--color-primary)',
            fontWeight: 600, fontSize: 15,
            cursor: pdfLoading ? 'not-allowed' : 'pointer',
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {pdfLoading ? (
            <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Generating Preview…</>
          ) : (
            '👁 Preview PDF'
          )}
        </button>

        <button
          type="button"
          onClick={handleFinalize}
          disabled={finalizing || saving || pdfLoading}
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
            disabled={saving || finalizing || pdfLoading}
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
