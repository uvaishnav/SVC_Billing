import { useEffect, useState } from 'react'
import type { WorkOrderWithClient, WorkOrderItem } from '../../db/types'
import { getWorkOrderItems } from '../../db/workOrdersDb'
import { getWorkOrderPdfSignedUrl } from '../../utils/uploadWorkOrderPdf'

interface Props {
  workOrder: WorkOrderWithClient
  onClose: () => void
  onEdit: (wo: WorkOrderWithClient) => void
  onRefresh: () => void
}

const STATUS_CONFIG = {
  active:        { label: 'Active',        bg: 'var(--color-success-highlight)', color: 'var(--color-success)' },
  expiring_soon: { label: 'Expiring Soon', bg: 'var(--color-warning-highlight)', color: 'var(--color-warning)' },
  expired:       { label: 'Expired',       bg: 'var(--color-error-highlight)',   color: 'var(--color-error)' },
  closed:        { label: 'Closed',        bg: 'var(--color-surface-offset)',    color: 'var(--color-text-muted)' },
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatValue(v: number | null) {
  if (v == null) return '—'
  return '₹' + v.toLocaleString('en-IN')
}

export default function WorkOrderDetailSheet({ workOrder: wo, onClose, onEdit }: Props) {
  const [items,          setItems]          = useState<WorkOrderItem[]>([])
  const [pdfLoading,     setPdfLoading]     = useState(false)
  const [pdfError,       setPdfError]       = useState<string | null>(null)
  const status = STATUS_CONFIG[wo.status] ?? STATUS_CONFIG.active

  useEffect(() => {
    getWorkOrderItems(wo.id).then(setItems)
  }, [wo.id])

  const totalContracted = items.reduce((sum, i) => sum + (i.amount ?? 0), 0)
  const totalBilled     = items.reduce((sum, i) => sum + (i.cumulative_billed_qty * i.rate), 0)

  async function handleViewPdf() {
    if (!wo.original_pdf_url) return
    setPdfLoading(true)
    setPdfError(null)
    try {
      const url = await getWorkOrderPdfSignedUrl(wo.original_pdf_url)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setPdfError('Could not open PDF. Please try again.')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,20,10,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--color-bg)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '640px', maxHeight: '92svh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'var(--color-primary)', padding: '12px 20px 16px', borderRadius: '20px 20px 0 0', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                {wo.wo_reference && (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-accent)' }}>{wo.wo_reference}</span>
                )}
                <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px', background: status.bg, color: status.color }}>{status.label}</span>
                {wo.original_pdf_url && (
                  <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>📎 PDF</span>
                )}
              </div>
              <h2 style={{ color: 'var(--color-bg)', fontSize: '18px', fontFamily: 'Playfair Display, serif', lineHeight: 1.3 }}>{wo.subject}</h2>
            </div>
            <button type="button" onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'var(--color-bg)', fontSize: '18px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>

          {/* PDF error */}
          {pdfError && (
            <div style={{ background: 'rgba(139,46,46,0.08)', border: '1px solid var(--color-error)', color: 'var(--color-error)', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' }}>{pdfError}</div>
          )}

          {/* Key info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Client',      value: wo.client_name  ?? '—' },
              { label: 'Project',     value: wo.project_name ?? '—' },
              { label: 'Issue Date',  value: formatDate(wo.issue_date) },
              { label: 'Duration',    value: wo.duration_months ? `${wo.duration_months} months` : '—' },
              { label: 'Valid From',  value: formatDate(wo.valid_from) },
              { label: 'Valid To',    value: formatDate(wo.valid_to) },
              { label: 'Total Value', value: formatValue(wo.total_value) },
              { label: 'Billing',     value: wo.billing_type === 'monthly_ra' ? 'Monthly RA Bills' : wo.billing_type },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--color-surface)', borderRadius: '10px', padding: '12px' }}>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Work Sans, sans-serif' }}>{label}</p>
                <p style={{ fontSize: '14px', color: 'var(--color-text)', fontWeight: 500, fontFamily: 'Work Sans, sans-serif' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Terms */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '20px', background: wo.rates_firm ? 'var(--color-warning-highlight)' : 'var(--color-surface-offset)', color: wo.rates_firm ? 'var(--color-warning)' : 'var(--color-text-muted)', fontWeight: 600 }}>
              {wo.rates_firm ? '⚠️ Rates Firm' : 'Rates Negotiable'}
            </span>
            <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '20px', background: wo.tds_applicable ? 'var(--color-info-highlight)' : 'var(--color-surface-offset)', color: wo.tds_applicable ? 'var(--color-info)' : 'var(--color-text-muted)', fontWeight: 600 }}>
              {wo.tds_applicable ? 'TDS Applicable' : 'No TDS'}
            </span>
          </div>

          {/* Work Order Items */}
          {items.length > 0 && (
            <>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', fontFamily: 'Work Sans, sans-serif' }}>Line Items</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {items.map(item => {
                  const usedPct = item.contracted_qty && item.contracted_qty > 0
                    ? Math.min(100, (item.cumulative_billed_qty / item.contracted_qty) * 100)
                    : null
                  const isNearLimit = usedPct !== null && usedPct >= 80
                  return (
                    <div key={item.id} style={{ background: 'var(--color-surface)', borderRadius: '10px', padding: '14px', border: `1px solid ${isNearLimit ? 'var(--color-warning)' : 'var(--color-border)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', margin: 0, flex: 1 }}>
                          {item.sl_no}. {item.description}
                          {item.sub_work_ref && <span style={{ fontSize: '12px', color: 'var(--color-accent)', marginLeft: '6px' }}>[{item.sub_work_ref}]</span>}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: usedPct !== null ? '10px' : 0 }}>
                        {item.unit           && <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Unit: {item.unit}</span>}
                        {item.contracted_qty && <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Contracted: {item.contracted_qty.toLocaleString('en-IN')}</span>}
                        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Rate: ₹{item.rate.toLocaleString('en-IN')}</span>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Billed so far: {item.cumulative_billed_qty.toLocaleString('en-IN')}</span>
                      </div>
                      {usedPct !== null && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: isNearLimit ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>Utilisation</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: isNearLimit ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>{usedPct.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '3px', background: 'var(--color-border)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${usedPct}%`, background: isNearLimit ? 'var(--color-warning)' : 'var(--color-accent)', borderRadius: '3px', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              {totalContracted > 0 && (
                <div style={{ background: 'var(--color-surface-offset)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Total Contracted Value</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{formatValue(totalContracted)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Billed Till Date (est.)</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>{formatValue(totalBilled)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {wo.notes && (
            <div style={{ background: 'var(--color-surface)', borderRadius: '10px', padding: '14px' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Work Sans, sans-serif' }}>Notes</p>
              <p style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.5, margin: 0 }}>{wo.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {wo.original_pdf_url && (
            <button
              type="button"
              onClick={handleViewPdf}
              disabled={pdfLoading}
              style={{ flex: 1, minWidth: '120px', padding: '16px', background: 'var(--color-surface-offset)', color: pdfLoading ? 'var(--color-text-faint)' : 'var(--color-text-muted)', fontWeight: 600, fontSize: '15px', borderRadius: '12px', border: '1px solid var(--color-border)', cursor: pdfLoading ? 'default' : 'pointer', fontFamily: 'Work Sans, sans-serif' }}
            >
              {pdfLoading ? 'Opening…' : '📎 View PDF'}
            </button>
          )}
          <button type="button" onClick={onClose} style={{ flex: 1, minWidth: '80px', padding: '16px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Close</button>
          <button type="button" onClick={() => onEdit(wo)} style={{ flex: 1, minWidth: '80px', padding: '16px', background: 'var(--color-accent)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Edit</button>
        </div>
      </div>
    </div>
  )
}
