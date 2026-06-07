// Wizard Section 2: Line Items
// Renders two completely different UIs depending on line_item_billing_type:
//   'quantity' → existing WO item checklist + qty inputs (unchanged logic)
//   'rental'   → vehicle rows with billing mode picker + distribution panel

import { useEffect, useState, useCallback } from 'react'
import type {
  InvoiceDraft,
  WorkOrderItem,
  InvoiceLineDraft,
  InvoiceRentalItemDraft,
  InvoiceItemDistributionDraft,
  Vehicle,
} from '../../db/types'
import { getWorkOrderItems, getWorkOrders } from '../../db/workOrdersDb'
import { getVehicles } from '../../db/vehiclesDb'
import { cardStyle, labelStyle, inputStyle } from '../settings/_components'
import {
  computeRentalSubtotal,
  equalSplitDistribution,
} from './useInvoiceDraft'

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// ────────────────────────────────────────────────────────────
export default function Section2Items({
  draft,
  setLineItems,
  setRentalItems,
  setItemDistribution,
}: {
  draft: InvoiceDraft
  setLineItems: (items: InvoiceLineDraft[]) => void
  setRentalItems: (items: InvoiceRentalItemDraft[]) => void
  setItemDistribution: (dist: InvoiceItemDistributionDraft[]) => void
}) {
  if (draft.line_item_billing_type === 'rental') {
    return (
      <Section2Rental
        draft={draft}
        setRentalItems={setRentalItems}
        setItemDistribution={setItemDistribution}
      />
    )
  }
  return (
    <Section2Quantity
      draft={draft}
      setLineItems={setLineItems}
    />
  )
}

// ─── QUANTITY MODE ──────────────────────────────────────────────────────────
function Section2Quantity({
  draft,
  setLineItems,
}: {
  draft: InvoiceDraft
  setLineItems: (items: InvoiceLineDraft[]) => void
}) {
  const [woItems, setWoItems]         = useState<WorkOrderItem[]>([])
  const [ratesFirm, setRatesFirm]     = useState(false)
  const [editingRate, setEditingRate] = useState<number | null>(null)
  const [loading, setLoading]         = useState(false)

  // ── Target Billing Amount state ──────────────────────────
  // This is UI-only. It drives qty back-calculation but never leaves this component.
  const [targetAmount, setTargetAmount] = useState<string>('')
  const [targetEditing, setTargetEditing] = useState(false)

  useEffect(() => {
    if (!draft.work_order_id) { setWoItems([]); return }
    setLoading(true)
    Promise.all([getWorkOrderItems(draft.work_order_id), getWorkOrders()])
      .then(([items, wos]) => {
        setWoItems(items)
        const wo = wos.find(w => w.id === draft.work_order_id)
        setRatesFirm(wo?.rates_firm ?? false)
        setLoading(false)
      })
  }, [draft.work_order_id])

  // Keep targetAmount in sync when qty is edited directly (Direction B → A)
  // Only update when user is NOT actively typing in the target field
  const subtotal = draft.line_items.reduce((s, i) => s + i.taxable_value, 0)
  useEffect(() => {
    if (!targetEditing) {
      setTargetAmount(subtotal > 0 ? subtotal.toFixed(2) : '')
    }
  }, [subtotal, targetEditing])

  // ── Back-calculate qty from target amount (Direction A → B) ────────────
  function applyTargetAmount(raw: string) {
    const total = parseFloat(raw)
    const selectedItems = draft.line_items
    if (!total || total <= 0 || selectedItems.length === 0) return

    // Equal rupee split: each item gets (total / N) rupees
    const perItemAmount = total / selectedItems.length

    setLineItems(selectedItems.map(li => {
      const qty = li.rate > 0
        ? parseFloat((perItemAmount / li.rate).toFixed(6))
        : 0
      return {
        ...li,
        qty,
        taxable_value: parseFloat((qty * li.rate).toFixed(2)),
      }
    }))
  }

  function isSelected(id: number) {
    return draft.line_items.some(li => li.work_order_item_id === id)
  }
  function getDraft(id: number) {
    return draft.line_items.find(li => li.work_order_item_id === id)
  }
  function toggleItem(woItem: WorkOrderItem) {
    if (isSelected(woItem.id)) {
      setLineItems(draft.line_items.filter(li => li.work_order_item_id !== woItem.id))
    } else {
      setLineItems([...draft.line_items, {
        work_order_item_id: woItem.id,
        sl_no:              draft.line_items.length + 1,
        description:        woItem.description,
        sac_id:             draft.sac_id,
        unit:               woItem.unit,
        qty:                0,
        rate:               woItem.rate,
        taxable_value:      0,
        rate_overridden:    false,
      }])
    }
  }
  function updateQty(id: number, qty: number) {
    setLineItems(draft.line_items.map(li =>
      li.work_order_item_id === id
        ? { ...li, qty, taxable_value: parseFloat((qty * li.rate).toFixed(2)) }
        : li
    ))
  }
  function updateRate(id: number, rate: number) {
    setLineItems(draft.line_items.map(li =>
      li.work_order_item_id === id
        ? { ...li, rate, taxable_value: parseFloat((li.qty * rate).toFixed(2)), rate_overridden: true }
        : li
    ))
    setEditingRate(null)
  }

  const selectedCount = draft.line_items.length
  const filledCount   = draft.line_items.filter(i => i.qty > 0).length

  if (!draft.work_order_id) return (
    <EmptyState message="No work order selected. Go back to Section 1 and select a work order." />
  )
  if (loading) return <LoadingState />

  return (
    <div style={{ padding: '16px', paddingBottom: 80 }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Select items to bill and enter quantities.
      </p>

      {/* ── Target Billing Amount helper ── */}
      <div style={{
        ...cardStyle,
        marginBottom: 20,
        background: 'var(--color-primary-highlight)',
        borderColor: targetAmount && parseFloat(targetAmount) > 0
          ? 'var(--color-primary)'
          : 'var(--color-border)',
        transition: 'border-color 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
            Target Billing Amount
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: 'var(--color-text-faint)',
            background: 'var(--color-surface-offset)', borderRadius: 4, padding: '2px 6px',
          }}>
            OPTIONAL
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
          Enter the total amount you want to bill. Quantities will be back-calculated
          {selectedCount > 1
            ? ` by splitting ₹ equally across ${selectedCount} selected item(s).`
            : ' from the rate of the selected item.'
          }
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Total Amount (₹)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={targetAmount}
              placeholder="e.g. 50000"
              disabled={selectedCount === 0}
              onFocus={() => setTargetEditing(true)}
              onBlur={() => {
                setTargetEditing(false)
                applyTargetAmount(targetAmount)
              }}
              onChange={e => setTargetAmount(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
              }}
              style={{
                ...inputStyle,
                textAlign: 'right',
                fontSize: 16,
                fontWeight: 600,
                opacity: selectedCount === 0 ? 0.4 : 1,
                cursor: selectedCount === 0 ? 'not-allowed' : 'text',
              }}
            />
          </div>
          <button
            type="button"
            disabled={selectedCount === 0 || !targetAmount || parseFloat(targetAmount) <= 0}
            onClick={() => applyTargetAmount(targetAmount)}
            style={{
              padding: '0 18px',
              height: 42,
              borderRadius: 10,
              border: 'none',
              background: (selectedCount === 0 || !targetAmount || parseFloat(targetAmount) <= 0)
                ? 'var(--color-border)'
                : 'var(--color-primary)',
              color: (selectedCount === 0 || !targetAmount || parseFloat(targetAmount) <= 0)
                ? 'var(--color-text-faint)'
                : '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: (selectedCount === 0 || !targetAmount || parseFloat(targetAmount) <= 0)
                ? 'not-allowed'
                : 'pointer',
              transition: 'all 0.15s',
              flexShrink: 0,
              marginBottom: 1,
            }}
          >
            Apply
          </button>
        </div>
        {selectedCount === 0 && (
          <p style={{ fontSize: 11, color: 'var(--color-text-faint)', marginTop: 8 }}>
            ↑ Select at least one item below to use this field.
          </p>
        )}
        {selectedCount > 1 && targetAmount && parseFloat(targetAmount) > 0 && (
          <p style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 8, fontWeight: 500 }}>
            ≈ ₹{fmt(parseFloat(targetAmount) / selectedCount)} per item (equal split)
          </p>
        )}
      </div>

      {woItems.map(woItem => {
        const selected = isSelected(woItem.id)
        const li = getDraft(woItem.id)
        const billed = woItem.cumulative_billed_qty
        return (
          <div key={woItem.id} style={{
            ...cardStyle, marginBottom: 12,
            borderColor: selected ? 'var(--color-accent)' : 'var(--color-border)',
            transition: 'border-color 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
              onClick={() => toggleItem(woItem)}>
              <Checkbox checked={selected} />
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

            {selected && li && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Qty ({woItem.unit ?? 'units'})</label>
                    <input type="number" min="0" step="any"
                      value={li.qty || ''} placeholder="0"
                      onChange={e => updateQty(woItem.id, parseFloat(e.target.value) || 0)}
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      Rate (₹/{woItem.unit ?? 'unit'})
                      {li.rate_overridden && (
                        <span style={{ color: 'var(--color-warning)', marginLeft: 4, fontSize: 10 }}>⚠ Overridden</span>
                      )}
                    </label>
                    {editingRate === woItem.id ? (
                      <input type="number" min="0" step="any" defaultValue={li.rate} autoFocus
                        onBlur={e => updateRate(woItem.id, parseFloat(e.target.value) || li.rate)}
                        style={{ ...inputStyle, textAlign: 'right', borderColor: 'var(--color-warning)' }}
                      />
                    ) : (
                      <div style={{ ...inputStyle, display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', cursor: 'pointer', color: 'var(--color-text)' }}
                        onClick={() => {
                          if (ratesFirm) {
                            if (!window.confirm('⚠️ This work order has firm rates. Changing the rate is unusual. Proceed?')) return
                          }
                          setEditingRate(woItem.id)
                        }}>
                        <span className="tabular">₹{fmt(li.rate)}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>tap to edit</span>
                      </div>
                    )}
                  </div>
                </div>
                {li.qty > 0 && (
                  <div style={{ marginTop: 10, textAlign: 'right', fontSize: 15, fontWeight: 600 }}>
                    Line Total: <span className="tabular">₹{fmt(li.taxable_value)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {draft.line_items.length > 0 && (
        <FloatingSubtotal
          label={`${filledCount} item(s) • Subtotal`}
          amount={subtotal}
        />
      )}
    </div>
  )
}

// ─── RENTAL MODE ───────────────────────────────────────────────────
function Section2Rental({
  draft,
  setRentalItems,
  setItemDistribution,
}: {
  draft: InvoiceDraft
  setRentalItems: (items: InvoiceRentalItemDraft[]) => void
  setItemDistribution: (dist: InvoiceItemDistributionDraft[]) => void
}) {
  const [vehicles, setVehicles]   = useState<Vehicle[]>([])
  const [woItems, setWoItems]     = useState<WorkOrderItem[]>([])
  const [loading, setLoading]     = useState(true)

  // Load vehicles + WO items in parallel
  useEffect(() => {
    setLoading(true)
    const promises: [Promise<Vehicle[]>, Promise<WorkOrderItem[]>] = [
      getVehicles(),
      draft.work_order_id ? getWorkOrderItems(draft.work_order_id) : Promise.resolve([]),
    ]
    Promise.all(promises).then(([v, items]) => {
      setVehicles(v.filter(v => v.is_active))
      setWoItems(items)
      setLoading(false)
    })
  }, [draft.work_order_id])

  const rentalTotal = draft.rental_items.reduce((s, ri) => s + ri.subtotal, 0)

  // IDs of vehicles already added (excluding nulls from unselected rows)
  const selectedVehicleIds = new Set(
    draft.rental_items.map(ri => ri.vehicle_id).filter((id): id is number => id !== null)
  )

  // ── Vehicle row handlers ─────────────────────────────────

  function addVehicleRow() {
    // Guard: don't add a new row if any existing row has no vehicle selected
    const hasIncompleteRow = draft.rental_items.some(ri => ri.vehicle_id === null)
    if (hasIncompleteRow) {
      window.alert('Please select a vehicle in the current row before adding another.')
      return
    }
    // Guard: all active vehicles are already added
    const availableCount = vehicles.filter(v => !selectedVehicleIds.has(v.id)).length
    if (availableCount === 0 && vehicles.length > 0) {
      window.alert('All available vehicles have already been added.')
      return
    }
    setRentalItems([...draft.rental_items, {
      vehicle_id:   null,
      reg_number:   '',
      vehicle_type: null,
      billing_mode: 'full_month',
      num_days:     null,
      monthly_rent: 0,
      subtotal:     0,
      sort_order:   draft.rental_items.length,
    }])
  }

  function removeVehicleRow(idx: number) {
    const updated = draft.rental_items.filter((_, i) => i !== idx)
      .map((ri, i) => ({ ...ri, sort_order: i }))
    setRentalItems(updated)
  }

  function updateVehicleRow(
    idx: number,
    patch: Partial<InvoiceRentalItemDraft>,
  ) {
    const updated = draft.rental_items.map((ri, i) => {
      if (i !== idx) return ri
      const merged = { ...ri, ...patch }
      // Always recompute subtotal when any relevant field changes
      merged.subtotal = computeRentalSubtotal(
        merged.monthly_rent,
        merged.billing_mode,
        merged.num_days,
      )
      return merged
    })
    setRentalItems(updated)
  }

  function handleVehicleSelect(idx: number, vehicleId: number) {
    const v = vehicles.find(v => v.id === vehicleId)
    if (!v) return
    updateVehicleRow(idx, {
      vehicle_id:   v.id,
      reg_number:   v.reg_number,
      vehicle_type: v.vehicle_type,
      monthly_rent: v.default_monthly_rent ?? 0,
    })
  }

  // ── Distribution handlers ───────────────────────────────

  /** When a WO item is toggled in the distribution checklist. */
  function toggleDistItem(woItem: WorkOrderItem) {
    const exists = draft.item_distribution.some(d => d.work_order_item_id === woItem.id)
    let newDist: InvoiceItemDistributionDraft[]
    if (exists) {
      newDist = draft.item_distribution.filter(d => d.work_order_item_id !== woItem.id)
    } else {
      newDist = [
        ...draft.item_distribution,
        {
          work_order_item_id: woItem.id,
          description:        woItem.description,
          sub_work_ref:       woItem.sub_work_ref,
          allocation_pct:     0,
          allocated_amount:   0,
        },
      ]
    }
    // Re-split equally after every toggle
    setItemDistribution(equalSplitDistribution(newDist, rentalTotal))
  }

  /** When user edits a percentage input directly. */
  function updateDistPct(idx: number, pct: number) {
    const updated = draft.item_distribution.map((d, i) =>
      i !== idx ? d : {
        ...d,
        allocation_pct:   pct,
        allocated_amount: parseFloat((rentalTotal * pct / 100).toFixed(2)),
      }
    )
    setItemDistribution(updated)
  }

  const distTotal = draft.item_distribution.reduce((s, d) => s + d.allocation_pct, 0)
  const distOk    = Math.abs(distTotal - 100) < 0.1

  // How many vehicles are still available to add
  const remainingVehicles = vehicles.filter(v => !selectedVehicleIds.has(v.id)).length
  const allVehiclesAdded  = vehicles.length > 0 && remainingVehicles === 0
  const hasIncompleteRow  = draft.rental_items.some(ri => ri.vehicle_id === null)

  if (loading) return <LoadingState />

  return (
    <div style={{ padding: '16px', paddingBottom: 100 }}>

      {/* ── Vehicle Rental Rows ── */}
      <SectionLabel>Vehicle Rental Charges</SectionLabel>

      {draft.rental_items.length === 0 && (
        <EmptyState message="No vehicles added yet. Tap + Add Vehicle below." small />
      )}

      {draft.rental_items.map((ri, idx) => (
        <RentalVehicleRow
          key={idx}
          ri={ri}
          idx={idx}
          vehicles={vehicles}
          selectedVehicleIds={selectedVehicleIds}
          onVehicleSelect={vid => handleVehicleSelect(idx, vid)}
          onUpdate={patch => updateVehicleRow(idx, patch)}
          onRemove={() => removeVehicleRow(idx)}
        />
      ))}

      <button
        type="button"
        onClick={addVehicleRow}
        disabled={hasIncompleteRow || allVehiclesAdded}
        style={{
          width: '100%', padding: '12px', marginTop: 8, marginBottom: 24,
          borderRadius: 10, border: '1.5px dashed var(--color-border)',
          background: 'transparent',
          color: (hasIncompleteRow || allVehiclesAdded) ? 'var(--color-text-faint)' : 'var(--color-primary)',
          fontWeight: 600, fontSize: 14,
          cursor: (hasIncompleteRow || allVehiclesAdded) ? 'not-allowed' : 'pointer',
          opacity: (hasIncompleteRow || allVehiclesAdded) ? 0.5 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {allVehiclesAdded
          ? '✓ All vehicles added'
          : hasIncompleteRow
            ? '⚠ Select a vehicle in the current row first'
            : `+ Add Vehicle${remainingVehicles > 0 ? ` (${remainingVehicles} remaining)` : ''}`
        }
      </button>

      {/* ── Distribution Panel (only when WO items are available) ── */}
      {woItems.length > 0 && rentalTotal > 0 && (
        <>
          <SectionLabel style={{ marginTop: 8 }}>
            Distribute ₹{fmt(rentalTotal)} to Work Order Items
          </SectionLabel>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Select the WO items this billing applies to. Total must add up to 100%.
          </p>

          {woItems.map(woItem => {
            const dist = draft.item_distribution.find(d => d.work_order_item_id === woItem.id)
            const selected = !!dist

            // Warn if allocated would exceed contracted amount
            const contractedAmount = (woItem.contracted_qty ?? 0) * woItem.rate
            const alreadyBilled   = woItem.cumulative_billed_qty * woItem.rate
            const remaining       = contractedAmount - alreadyBilled
            const overLimit       = selected && dist && dist.allocated_amount > remaining && remaining > 0

            return (
              <div key={woItem.id} style={{
                ...cardStyle, marginBottom: 10,
                borderColor: overLimit ? 'var(--color-error)'
                           : selected  ? 'var(--color-accent)'
                           : 'var(--color-border)',
                transition: 'border-color 0.15s',
              }}>
                {/* Toggle row */}
                <div
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
                  onClick={() => toggleDistItem(woItem)}
                >
                  <Checkbox checked={selected} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                      {woItem.sub_work_ref && (
                        <span style={{ fontSize: 11, color: 'var(--color-text-faint)', marginRight: 6 }}>[{woItem.sub_work_ref}]</span>
                      )}
                      {woItem.description}
                    </div>
                    {contractedAmount > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        Contract: ₹{fmt(contractedAmount)} • Billed so far: ₹{fmt(alreadyBilled)}
                        {remaining > 0 && (
                          <span style={{ color: remaining < dist?.allocated_amount! ? 'var(--color-error)' : 'var(--color-success)', marginLeft: 6 }}>
                            (Remaining: ₹{fmt(remaining)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Allocation inputs */}
                {selected && dist && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Allocation (%)</label>
                        <input
                          type="number" min="0" max="100" step="0.001"
                          value={dist.allocation_pct}
                          onChange={e => updateDistPct(
                            draft.item_distribution.findIndex(d => d.work_order_item_id === woItem.id),
                            parseFloat(e.target.value) || 0
                          )}
                          style={{ ...inputStyle, textAlign: 'right' }}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Amount (₹)</label>
                        <div style={{ ...inputStyle, color: 'var(--color-text)', display: 'flex',
                          alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span className="tabular">₹{fmt(dist.allocated_amount)}</span>
                        </div>
                      </div>
                    </div>
                    {overLimit && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-error)', fontWeight: 500 }}>
                        ⚠️ Allocated amount exceeds remaining contract value for this item.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Distribution total indicator */}
          {draft.item_distribution.length > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', borderRadius: 10, marginTop: 4,
              background: distOk ? 'var(--color-success-highlight)' : 'var(--color-error-highlight)',
              border: `1px solid ${distOk ? 'var(--color-success)' : 'var(--color-error)'}`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600,
                color: distOk ? 'var(--color-success)' : 'var(--color-error)' }}>
                {distOk ? '✅ Distribution: 100%' : `⚠️ Distribution: ${distTotal.toFixed(1)}% (must total 100%)`}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {draft.item_distribution.length} item(s)
              </span>
            </div>
          )}
        </>
      )}

      {/* Floating total bar */}
      {rentalTotal > 0 && (
        <FloatingSubtotal
          label={`${draft.rental_items.length} vehicle(s) • Rental Total`}
          amount={rentalTotal}
        />
      )}
    </div>
  )
}

// ─── Rental Vehicle Row ─────────────────────────────────────────────────
function RentalVehicleRow({
  ri, idx, vehicles, selectedVehicleIds, onVehicleSelect, onUpdate, onRemove,
}: {
  ri: InvoiceRentalItemDraft
  idx: number
  vehicles: Vehicle[]
  selectedVehicleIds: Set<number>
  onVehicleSelect: (vehicleId: number) => void
  onUpdate: (patch: Partial<InvoiceRentalItemDraft>) => void
  onRemove: () => void
}) {
  return (
    <div style={{ ...cardStyle, marginBottom: 12 }}>
      {/* Header row: vehicle selector + remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Vehicle</label>
          <select
            value={ri.vehicle_id ?? ''}
            onChange={e => onVehicleSelect(Number(e.target.value))}
            style={{ ...inputStyle, color: ri.vehicle_id ? 'var(--color-text)' : 'var(--color-text-muted)' }}
          >
            <option value="">Select vehicle…</option>
            {vehicles.map(v => {
              // A vehicle is unavailable if it's already selected in a *different* row
              const takenByOther = selectedVehicleIds.has(v.id) && v.id !== ri.vehicle_id
              return (
                <option key={v.id} value={v.id} disabled={takenByOther}>
                  {v.reg_number}{v.vehicle_type ? ` — ${v.vehicle_type}` : ''}{takenByOther ? ' (already added)' : ''}
                </option>
              )
            })}
          </select>
        </div>
        <button
          type="button" onClick={onRemove}
          style={{
            marginTop: 18, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-error)', fontSize: 14, cursor: 'pointer', flexShrink: 0,
          }}
          aria-label="Remove vehicle row"
        >
          ✕
        </button>
      </div>

      {/* Billing mode toggle */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Billing Mode</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['full_month', 'partial_days'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => onUpdate({ billing_mode: mode, num_days: null })}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10,
                border: `2px solid ${ri.billing_mode === mode ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: ri.billing_mode === mode ? 'var(--color-primary-highlight)' : 'transparent',
                color: ri.billing_mode === mode ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: ri.billing_mode === mode ? 700 : 400,
                fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {mode === 'full_month' ? '● Full Month' : '◔ Partial Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Monthly rent */}
      <div style={{ display: 'grid', gridTemplateColumns: ri.billing_mode === 'partial_days' ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>
            Monthly Rent (₹)
            {ri.vehicle_id && <span style={{ fontSize: 10, color: 'var(--color-text-faint)', marginLeft: 4 }}>pre-filled from vehicle</span>}
          </label>
          <input
            type="number" min="0" step="any"
            value={ri.monthly_rent || ''}
            placeholder="0.00"
            onChange={e => onUpdate({ monthly_rent: parseFloat(e.target.value) || 0 })}
            style={{ ...inputStyle, textAlign: 'right' }}
          />
        </div>

        {/* Partial days input */}
        {ri.billing_mode === 'partial_days' && (
          <div>
            <label style={labelStyle}>Number of Days</label>
            <input
              type="number" min="1" max="31" step="1"
              value={ri.num_days ?? ''}
              placeholder="e.g. 15"
              onChange={e => onUpdate({ num_days: parseInt(e.target.value) || null })}
              style={{ ...inputStyle, textAlign: 'right' }}
            />
          </div>
        )}
      </div>

      {/* Subtotal */}
      {ri.subtotal > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderRadius: 10,
          background: 'var(--color-surface-offset)',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {ri.billing_mode === 'full_month'
              ? 'Full month rental'
              : `₹${fmt(ri.monthly_rent)} ÷ 30 × ${ri.num_days} days`
            }
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
            <span className="tabular">₹{fmt(ri.subtotal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared small components ───────────────────────────────────────

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
      border: `2px solid ${checked ? 'var(--color-accent)' : 'var(--color-border)'}`,
      background: checked ? 'var(--color-accent)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {checked && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
    </div>
  )
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, ...style }}>
      {children}
    </div>
  )
}

function FloatingSubtotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div style={{
      position: 'fixed', bottom: 64, left: 0, right: 0,
      background: 'var(--color-primary)', color: 'var(--color-accent)',
      padding: '12px 20px', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', zIndex: 40,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span className="tabular" style={{ fontSize: 17, fontWeight: 700 }}>₹{fmt(amount)}</span>
    </div>
  )
}

function EmptyState({ message, small }: { message: string; small?: boolean }) {
  return (
    <div style={{ padding: small ? '16px' : '32px 16px', textAlign: 'center' }}>
      {!small && <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>}
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>{message}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-faint)' }}>
      Loading…
    </div>
  )
}
