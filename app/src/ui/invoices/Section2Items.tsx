// Wizard Section 2: Work Order Item Selection
// Checklist of WO items; each checked item expands to show qty input.
// Rate shown read-only; tap-to-edit with warning if rates_firm.
import React, { useEffect, useState } from 'react'
import type { InvoiceDraft, WorkOrderItem, InvoiceLineDraft } from '../../db/types'
import { getWorkOrderItems } from '../../db/workOrdersDb'
import { getWorkOrders } from '../../db/workOrdersDb'
import { cardStyle, labelStyle, inputStyle } from '../settings/_components'

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export default function Section2Items({
  draft, setLineItems,
}: {
  draft: InvoiceDraft
  setLineItems: (items: InvoiceLineDraft[]) => void
}) {
  const [woItems, setWoItems]           = useState<WorkOrderItem[]>([])
  const [ratesFirm, setRatesFirm]       = useState(false)
  const [editingRate, setEditingRate]   = useState<number | null>(null)
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    if (!draft.work_order_id) { setWoItems([]); return }
    setLoading(true)
    Promise.all([
      getWorkOrderItems(draft.work_order_id),
      getWorkOrders(),
    ]).then(([items, wos]) => {
      setWoItems(items)
      const wo = wos.find(w => w.id === draft.work_order_id)
      setRatesFirm(wo?.rates_firm ?? false)
      setLoading(false)
    })
  }, [draft.work_order_id])

  function isSelected(itemId: number) {
    return draft.line_items.some(li => li.work_order_item_id === itemId)
  }

  function getDraft(itemId: number): InvoiceLineDraft | undefined {
    return draft.line_items.find(li => li.work_order_item_id === itemId)
  }

  function toggleItem(woItem: WorkOrderItem) {
    if (isSelected(woItem.id)) {
      setLineItems(draft.line_items.filter(li => li.work_order_item_id !== woItem.id))
    } else {
      const newItem: InvoiceLineDraft = {
        work_order_item_id: woItem.id,
        sl_no:              draft.line_items.length + 1,
        description:        woItem.description,
        sac_id:             draft.sac_id,
        unit:               woItem.unit,
        qty:                0,
        rate:               woItem.rate,
        taxable_value:      0,
        rate_overridden:    false,
      }
      setLineItems([...draft.line_items, newItem])
    }
  }

  function updateQty(itemId: number, qty: number) {
    const items = draft.line_items.map(li =>
      li.work_order_item_id === itemId
        ? { ...li, qty, taxable_value: parseFloat((qty * li.rate).toFixed(2)) }
        : li
    )
    setLineItems(items)
  }

  function updateRate(itemId: number, rate: number) {
    const items = draft.line_items.map(li =>
      li.work_order_item_id === itemId
        ? { ...li, rate, taxable_value: parseFloat((li.qty * rate).toFixed(2)), rate_overridden: true }
        : li
    )
    setLineItems(items)
    setEditingRate(null)
  }

  const subtotal = draft.line_items.reduce((s, i) => s + i.taxable_value, 0)

  if (!draft.work_order_id) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>
          No work order selected. Go back to Section 1 and select a work order to load items.
        </p>
      </div>
    )
  }

  if (loading) return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-faint)' }}>Loading items...</div>
  )

  return (
    <div style={{ padding: '16px', paddingBottom: 80 }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Select the items to bill and enter quantities.
      </p>

      {woItems.map((woItem, idx) => {
        const selected = isSelected(woItem.id)
        const li = getDraft(woItem.id)
        const billed = woItem.cumulative_billed_qty

        return (
          <div key={woItem.id} style={{
            ...cardStyle,
            marginBottom: 12,
            borderColor: selected ? 'var(--color-accent)' : 'var(--color-border)',
            transition: 'border-color 0.15s',
          }}>
            {/* Checkbox row */}
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
              onClick={() => toggleItem(woItem)}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
                border: `2px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: selected ? 'var(--color-accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)', marginBottom: 2 }}>
                  {woItem.sub_work_ref && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-faint)', marginRight: 6 }}>[{woItem.sub_work_ref}]</span>
                  )}
                  {woItem.description}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>Unit: {woItem.unit ?? '—'}</span>
                  <span>Rate: ₹{fmt(woItem.rate)}</span>
                  {billed > 0 && (
                    <span style={{ color: 'var(--color-warning)' }}>Billed so far: {billed} {woItem.unit ?? 'units'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded: qty + rate */}
            {selected && li && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Qty */}
                  <div>
                    <label style={labelStyle}>Qty ({woItem.unit ?? 'units'})</label>
                    <input
                      type="number" min="0" step="any"
                      value={li.qty || ''}
                      placeholder="0"
                      onChange={e => updateQty(woItem.id, parseFloat(e.target.value) || 0)}
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>

                  {/* Rate */}
                  <div>
                    <label style={labelStyle}>
                      Rate (₹/{woItem.unit ?? 'unit'})
                      {li.rate_overridden && (
                        <span style={{ color: 'var(--color-warning)', marginLeft: 4, fontSize: 10 }}>⚠ Overridden</span>
                      )}
                    </label>
                    {editingRate === woItem.id ? (
                      <input
                        type="number" min="0" step="any"
                        defaultValue={li.rate}
                        autoFocus
                        onBlur={e => updateRate(woItem.id, parseFloat(e.target.value) || li.rate)}
                        style={{ ...inputStyle, textAlign: 'right', borderColor: 'var(--color-warning)' }}
                      />
                    ) : (
                      <div
                        style={{
                          ...inputStyle,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          cursor: 'pointer', color: 'var(--color-text)',
                        }}
                        onClick={() => {
                          if (ratesFirm) {
                            const yes = window.confirm(
                              '⚠️ This work order has firm rates. Changing the rate is unusual. Proceed?'
                            )
                            if (!yes) return
                          }
                          setEditingRate(woItem.id)
                        }}
                      >
                        <span className="tabular">₹{fmt(li.rate)}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>tap to edit</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Line total */}
                {li.qty > 0 && (
                  <div style={{
                    marginTop: 10,
                    textAlign: 'right',
                    fontSize: 15, fontWeight: 600,
                    color: 'var(--color-text)',
                  }}>
                    Line Total: <span className="tabular">₹{fmt(li.taxable_value)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Floating subtotal */}
      {draft.line_items.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 64, left: 0, right: 0,
          background: 'var(--color-primary)',
          color: 'var(--color-accent)',
          padding: '12px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          zIndex: 40,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {draft.line_items.filter(i => i.qty > 0).length} item(s) • Subtotal
          </span>
          <span className="tabular" style={{ fontSize: 17, fontWeight: 700 }}>₹{fmt(subtotal)}</span>
        </div>
      )}
    </div>
  )
}
