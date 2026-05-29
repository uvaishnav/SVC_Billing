// Wizard Section 3: Vehicles + AI Description
// Rental mode: vehicles panel is hidden (they are already in Section 2 rental_items).
//              Auto-generate triggers on rental_items instead of line_items.
// Quantity mode: original vehicles panel + line_items trigger (unchanged).
import React, { useEffect, useState, useRef } from 'react'
import type { InvoiceDraft, Vehicle, InvoiceVehicleDraft } from '../../db/types'
import { getVehicles } from '../../db/vehiclesDb'
import { generateInvoiceDescription, refineInvoiceDescription } from '../../utils/generateInvoiceDescription'
import { cardStyle, labelStyle, inputStyle } from '../settings/_components'
import { getClients } from '../../db/clientsDb'
import { getWorkOrders } from '../../db/workOrdersDb'
import { getSacCodes } from '../../db/settingsDb'

export default function Section3Description({
  draft, setVehicles, patch,
}: {
  draft: InvoiceDraft
  setVehicles: (v: InvoiceVehicleDraft[]) => void
  patch: (u: Partial<InvoiceDraft>) => void
}) {
  const isRental = draft.line_item_billing_type === 'rental'

  const [allVehicles, setAllVehicles]       = useState<Vehicle[]>([])
  const [showPicker, setShowPicker]         = useState(false)
  const [generating, setGenerating]         = useState(false)
  const [refining, setRefining]             = useState(false)
  const [refinement, setRefinement]         = useState('')
  const [charCount, setCharCount]           = useState(draft.overall_description?.length ?? 0)
  const [genError, setGenError]             = useState<string | null>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  // Context needed for AI call
  const [clientName, setClientName]         = useState('')
  const [woRef, setWoRef]                   = useState<string | null>(null)
  const [woSubject, setWoSubject]           = useState<string | null>(null)
  const [sacDesc, setSacDesc]               = useState<string | null>(null)

  useEffect(() => {
    // Only needed in quantity mode — rental mode doesn't use this picker
    if (!isRental) getVehicles().then(vs => setAllVehicles(vs.filter(v => v.is_active)))
  }, [isRental])

  // Load AI context (client name, WO ref, SAC desc)
  useEffect(() => {
    async function loadContext() {
      const [clients, wos, sacs] = await Promise.all([
        getClients(), getWorkOrders(), getSacCodes(),
      ])
      const client = clients.find(c => c.id === draft.client_id)
      setClientName(client?.name ?? '')
      const wo = wos.find(w => w.id === draft.work_order_id)
      setWoRef(wo?.wo_reference ?? null)
      setWoSubject(wo?.subject ?? null)
      const sac = sacs.find(s => s.id === draft.sac_id)
      setSacDesc(sac ? `${sac.sac_code} - ${sac.nickname}` : null)
    }
    loadContext()
  }, [draft.client_id, draft.work_order_id, draft.sac_id])

  // Auto-generate when section first loads with enough context.
  // Trigger condition differs by billing type:
  //   quantity: wait for at least one line item
  //   rental:   wait for at least one confirmed rental item
  const hasGenerated = useRef(false)
  const quantityReady = !isRental && draft.line_items.length > 0 && !!clientName
  const rentalReady   =  isRental
    && draft.rental_items.filter(ri => ri.vehicle_id !== null).length > 0
    && !!clientName

  useEffect(() => {
    if (!hasGenerated.current && (quantityReady || rentalReady)) {
      hasGenerated.current = true
      handleGenerate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantityReady, rentalReady])

  async function handleGenerate() {
    if (!clientName) return
    setGenerating(true)
    setGenError(null)
    try {
      const desc = await generateInvoiceDescription({
        draft, client_name: clientName,
        wo_reference: woRef, wo_subject: woSubject, sac_description: sacDesc,
      })
      patch({ overall_description: desc })
      setCharCount(desc.length)
    } catch (e: any) {
      setGenError(e.message ?? 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRefine() {
    if (!refinement.trim()) return
    setRefining(true)
    setGenError(null)
    try {
      const desc = await refineInvoiceDescription(
        { draft, client_name: clientName, wo_reference: woRef, wo_subject: woSubject, sac_description: sacDesc },
        draft.overall_description,
        refinement.trim(),
      )
      patch({ overall_description: desc })
      setCharCount(desc.length)
      setRefinement('')
    } catch (e: any) {
      setGenError(e.message ?? 'Refinement failed')
    } finally {
      setRefining(false)
    }
  }

  // ── Quantity mode: vehicle picker helpers ──────────────────────
  const addedIds  = new Set(draft.vehicles.map(v => v.vehicle_id))
  const available = allVehicles.filter(v => !addedIds.has(v.id))

  function addVehicle(v: Vehicle) {
    setVehicles([...draft.vehicles, {
      vehicle_id:             v.id,
      reg_number:             v.reg_number,
      vehicle_type:           v.vehicle_type,
      include_in_description: true,
    }])
    setShowPicker(false)
    hasGenerated.current = false
  }

  function removeVehicle(vehicleId: number) {
    setVehicles(draft.vehicles.filter(v => v.vehicle_id !== vehicleId))
  }

  function toggleInclude(vehicleId: number) {
    setVehicles(draft.vehicles.map(v =>
      v.vehicle_id === vehicleId ? { ...v, include_in_description: !v.include_in_description } : v
    ))
  }

  return (
    <div style={{ padding: '16px', paddingBottom: 24 }}>

      {/* ── Vehicles block: quantity mode only ── */}
      {!isRental && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🚛 Vehicles Involved
            </span>
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1.5px solid var(--color-accent)',
                background: 'transparent', color: 'var(--color-accent)', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              + Add Vehicle
            </button>
          </div>

          {/* Vehicle picker */}
          {showPicker && (
            <div style={{ ...cardStyle, marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
              {available.length === 0
                ? <p style={{ color: 'var(--color-text-faint)', fontSize: 13, margin: 0 }}>All vehicles added.</p>
                : available.map(v => (
                  <button
                    key={v.id} type="button"
                    onClick={() => addVehicle(v)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 12px', border: 'none', borderBottom: '1px solid var(--color-border)',
                      background: 'transparent', cursor: 'pointer', fontSize: 14,
                      color: 'var(--color-text)',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{v.reg_number}</span>
                    {v.vehicle_type && <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>{v.vehicle_type}</span>}
                  </button>
                ))
              }
            </div>
          )}

          {draft.vehicles.length === 0 && !showPicker && (
            <p style={{ fontSize: 13, color: 'var(--color-text-faint)', margin: 0 }}>
              No vehicles added. Optional — vehicles can be mentioned in the description.
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {draft.vehicles.map(v => (
              <div key={v.vehicle_id} style={{
                ...cardStyle, padding: '10px 14px',
                display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{v.reg_number}</span>
                  <button
                    type="button" onClick={() => removeVehicle(v.vehicle_id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-error)', fontSize: 16, lineHeight: 1, padding: 0 }}
                  >×</button>
                </div>
                {v.vehicle_type && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{v.vehicle_type}</span>}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={v.include_in_description}
                    onChange={() => toggleInclude(v.vehicle_id)}
                  />
                  Include in description
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rental mode: show read-only vehicle summary from Section 2 ── */}
      {isRental && draft.rental_items.filter(ri => ri.vehicle_id !== null).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            🚛 Vehicles Being Billed
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {draft.rental_items
              .filter(ri => ri.vehicle_id !== null)
              .map((ri, i) => (
                <div key={i} style={{
                  padding: '8px 12px', borderRadius: 10,
                  background: 'var(--color-surface-offset)',
                  border: '1px solid var(--color-border)',
                  fontSize: 13,
                }}>
                  <span style={{ fontWeight: 600 }}>{ri.reg_number}</span>
                  {ri.vehicle_type && (
                    <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>{ri.vehicle_type}</span>
                  )}
                  <span style={{ color: 'var(--color-text-faint)', marginLeft: 8, fontSize: 12 }}>
                    {ri.billing_mode === 'full_month' ? 'Full month' : `${ri.num_days} days`}
                  </span>
                </div>
              ))
            }
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-faint)', marginTop: 8, margin: '8px 0 0' }}>
            Vehicles are set in the Items step. The AI description will reference them automatically.
          </p>
        </div>
      )}

      {/* ── Description block ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ✨ Overall Description
          </span>
          <button
            type="button" onClick={handleGenerate} disabled={generating}
            style={{
              padding: '6px 14px', borderRadius: 20,
              border: '1.5px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {generating ? '⌛ Generating...' : '↺ Regenerate'}
          </button>
        </div>

        {generating && (
          <div style={{ ...cardStyle, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: 'var(--color-text-faint)', fontSize: 14 }}>Generating description…</span>
          </div>
        )}

        {!generating && (
          <>
            <textarea
              ref={descRef}
              rows={5}
              value={draft.overall_description}
              onChange={e => {
                patch({ overall_description: e.target.value })
                setCharCount(e.target.value.length)
              }}
              placeholder="AI-generated description will appear here. You can edit it directly."
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, marginBottom: 4 }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: charCount > 300 ? 'var(--color-warning)' : 'var(--color-text-faint)', marginBottom: 12 }}>
              {charCount}/300 chars{charCount > 300 ? ' — consider shortening' : ''}
            </div>
          </>
        )}

        {genError && (
          <div style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 12 }}>⚠️ {genError}</div>
        )}

        {/* Refinement input */}
        <div style={{ marginTop: 4 }}>
          <label style={labelStyle}>How should I edit the description?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={refinement}
              onChange={e => setRefinement(e.target.value)}
              placeholder="e.g. Make it more formal / Add vehicle count / Remove dates"
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRefine() } }}
            />
            <button
              type="button" onClick={handleRefine}
              disabled={refining || !refinement.trim()}
              style={{
                padding: '0 18px', borderRadius: 12, border: 'none',
                background: refinement.trim() ? 'var(--color-accent)' : 'var(--color-border)',
                color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {refining ? '...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
