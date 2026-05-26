import React, { useState } from 'react'
import type { InvoiceDraft, InvoiceLineItemDraft, WorkOrderItem } from '../../db/types'

interface Props {
  draft: InvoiceDraft
  woItems: WorkOrderItem[]
  ratesFirm: boolean
  onChange: (patch: Partial<InvoiceDraft>) => void
  onNext: () => void
  onBack: () => void
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(200,169,106,0.15)',
  borderRadius: '10px',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

export default function Section2Items({ draft, woItems, ratesFirm, onChange, onNext, onBack }: Props) {
  const [rateEditWarned, setRateEditWarned] = useState<Set<number>>(new Set())

  function toggleItem(woItem: WorkOrderItem) {
    const exists = draft.line_items.find(i => i.work_order_item_id === woItem.id)
    if (exists) {
      onChange({ line_items: draft.line_items.filter(i => i.work_order_item_id !== woItem.id) })
    } else {
      const newItem: InvoiceLineItemDraft = {
        work_order_item_id:    woItem.id,
        sl_no:                 draft.line_items.length + 1,
        description:           woItem.description,
        unit:                  woItem.unit,
        qty:                   0,
        rate:                  woItem.rate,
        rate_overridden:       false,
        taxable_value:         0,
        wo_item_rate:          woItem.rate,
        contracted_qty:        woItem.contracted_qty,
        cumulative_billed_qty: woItem.cumulative_billed_qty,
      }
      onChange({ line_items: [...draft.line_items, newItem] })
    }
  }

  function updateItem(woItemId: number, patch: Partial<InvoiceLineItemDraft>) {
    onChange({
      line_items: draft.line_items.map(i => {
        if (i.work_order_item_id !== woItemId) return i
        const updated = { ...i, ...patch }
        updated.taxable_value = parseFloat((updated.qty * updated.rate).toFixed(2))
        if (patch.rate !== undefined && patch.rate !== i.wo_item_rate) {
          updated.rate_overridden = true
        }
        return updated
      })
    })
  }

  function handleRateEdit(woItemId: number, newRate: number) {
    if (ratesFirm && !rateEditWarned.has(woItemId)) {
      setRateEditWarned(prev => new Set([...prev, woItemId]))
    }
    updateItem(woItemId, { rate: newRate })
  }

  const subtotal = draft.line_items.reduce((s, i) => s + i.taxable_value, 0)
  const isValid  = draft.line_items.length > 0 && draft.line_items.every(i => i.qty > 0)

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  // Items from WO
  const availableItems = woItems

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif' }}>
        Select work items to bill. Enter quantity for each selected item.
      </p>

      {availableItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-faint)', fontSize: '14px' }}>
          {draft.work_order_id ? 'No items found for this work order.' : 'Select a work order in Section 1 to load items.'}
        </div>
      )}

      {availableItems.map(woItem => {
        const selected = draft.line_items.find(i => i.work_order_item_id === woItem.id)
        const warned   = rateEditWarned.has(woItem.id)

        return (
          <div key={woItem.id} style={{
            ...card,
            borderColor: selected ? 'rgba(200,169,106,0.4)' : 'rgba(200,169,106,0.15)',
            background: selected ? 'rgba(200,169,106,0.06)' : 'rgba(255,255,255,0.04)',
          }}>
            {/* Checkbox + description */}
            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type='checkbox'
                checked={!!selected}
                onChange={() => toggleItem(woItem)}
                style={{ marginTop: '2px', accentColor: 'var(--color-accent)', width: '16px', height: '16px' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif', fontWeight: 500 }}>
                  {woItem.description}
                  {woItem.sub_work_ref && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginLeft: '6px' }}>
                      ({woItem.sub_work_ref})
                    </span>
                  )}
                </div>
                {/* Billed qty hint */}
                {woItem.contracted_qty != null && (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginTop: '2px' }}>
                    {woItem.cumulative_billed_qty} of {woItem.contracted_qty} {woItem.unit ?? 'units'} billed so far
                  </div>
                )}
              </div>
            </label>

            {/* Expanded: qty + rate */}
            {selected && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px', paddingLeft: '26px' }}>

                {/* Rate (editable with warning) */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginBottom: '4px', fontFamily: 'Work Sans, sans-serif' }}>
                      Rate / {woItem.unit ?? 'unit'}
                    </div>
                    <input
                      type='number'
                      min='0'
                      step='0.01'
                      value={selected.rate}
                      onChange={e => handleRateEdit(woItem.id, parseFloat(e.target.value) || 0)}
                      style={{
                        padding: '8px 10px',
                        background: selected.rate_overridden ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${selected.rate_overridden ? 'rgba(245,158,11,0.4)' : 'rgba(200,169,106,0.2)'}`,
                        borderRadius: '8px',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: 'Work Sans, sans-serif',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginBottom: '4px', fontFamily: 'Work Sans, sans-serif' }}>
                      Quantity
                    </div>
                    <input
                      type='number'
                      min='0'
                      step='0.001'
                      value={selected.qty || ''}
                      onChange={e => updateItem(woItem.id, { qty: parseFloat(e.target.value) || 0 })}
                      placeholder='Enter qty'
                      style={{
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(200,169,106,0.2)',
                        borderRadius: '8px',
                        color: 'var(--color-text)',
                        fontSize: '14px',
                        fontFamily: 'Work Sans, sans-serif',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Rate override warning */}
                {warned && ratesFirm && selected.rate_overridden && (
                  <div style={{
                    padding: '8px 10px',
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f59e0b',
                    fontFamily: 'Work Sans, sans-serif',
                  }}>
                    ⚠️ This work order has firm rates. You are overriding ₹{selected.wo_item_rate}/{woItem.unit ?? 'unit'}.
                  </div>
                )}

                {/* Line total */}
                <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: 600, color: 'var(--color-accent)', fontFamily: 'Work Sans, sans-serif' }}>
                  {fmt(selected.taxable_value)}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Subtotal */}
      {draft.line_items.length > 0 && (
        <div style={{
          padding: '14px',
          background: 'rgba(200,169,106,0.08)',
          borderRadius: '10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'Work Sans, sans-serif', fontSize: '14px', color: 'var(--color-text-faint)' }}>
            Taxable Subtotal ({draft.line_items.length} items)
          </span>
          <span style={{ fontFamily: 'Work Sans, sans-serif', fontSize: '16px', fontWeight: 700, color: 'var(--color-accent)' }}>
            {fmt(subtotal)}
          </span>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onBack} style={{
          flex: 1, padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(200,169,106,0.2)',
          borderRadius: '10px', color: 'var(--color-text-faint)',
          fontSize: '14px', fontFamily: 'Work Sans, sans-serif', cursor: 'pointer',
        }}>← Back</button>
        <button onClick={onNext} disabled={!isValid} style={{
          flex: 2, padding: '12px',
          background: isValid ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
          color: isValid ? 'var(--color-primary)' : 'var(--color-text-faint)',
          border: 'none', borderRadius: '10px',
          fontSize: '14px', fontWeight: 700,
          fontFamily: 'Work Sans, sans-serif',
          cursor: isValid ? 'pointer' : 'default',
        }}>Next → Description ✨</button>
      </div>
    </div>
  )
}
