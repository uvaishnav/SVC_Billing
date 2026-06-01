// Wizard Section 3: Vehicles + AI Description
//
// DESIGN: AI generation is NEVER triggered automatically.
// The user must explicitly click one of the three action buttons:
//   1. "Generate with AI"  — shown only when description is empty
//   2. "↺ Regenerate"      — shown only when description already has content
//   3. "Improve with AI"   — refine existing text via a typed instruction
//                            (disabled if description is empty)
//
// Rental mode: vehicles panel is hidden (they are already in Section 2 rental_items).
// Quantity mode: original vehicles panel (unchanged).
import React, { useEffect, useState, useRef } from 'react'
import type { InvoiceDraft, Vehicle, InvoiceVehicleDraft } from '../../db/types'
import { getVehicles } from '../../db/vehiclesDb'
import { generateInvoiceDescription, refineInvoiceDescription } from '../../utils/generateInvoiceDescription'
import { cardStyle, labelStyle, inputStyle } from '../settings/_components'
import { getWorkOrders } from '../../db/workOrdersDb'
import { getSacCodes } from '../../db/settingsDb'

// Character limit for the description field
const CHAR_LIMIT = 350

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

  // Context needed for AI call — client_name intentionally excluded
  const [woRef, setWoRef]                   = useState<string | null>(null)
  const [woSubject, setWoSubject]           = useState<string | null>(null)
  const [sacDesc, setSacDesc]               = useState<string | null>(null)

  useEffect(() => {
    // Only needed in quantity mode — rental mode doesn't use this picker
    if (!isRental) getVehicles().then(vs => setAllVehicles(vs.filter(v => v.is_active)))
  }, [isRental])

  // Load AI context (WO ref, SAC desc — no client name)
  useEffect(() => {
    async function loadContext() {
      const [wos, sacs] = await Promise.all([
        getWorkOrders(), getSacCodes(),
      ])
      const wo = wos.find(w => w.id === draft.work_order_id)
      setWoRef(wo?.wo_reference ?? null)
      setWoSubject(wo?.subject ?? null)
      const sac = sacs.find(s => s.id === draft.sac_id)
      setSacDesc(sac ? `${sac.sac_code} - ${sac.nickname}` : null)
    }
    loadContext()
  }, [draft.work_order_id, draft.sac_id])

  // ── NO auto-generate useEffect ─────────────────────────────────
  // AI is only triggered on explicit user action (button click).
  // hasGenerated ref removed — it was causing re-generation on every
  // remount (e.g. navigating back to this section, or reopening a draft).

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    try {
      const desc = await generateInvoiceDescription({
        draft,
        wo_reference: woRef,
        wo_subject: woSubject,
        sac_description: sacDesc,
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
        { draft, wo_reference: woRef, wo_subject: woSubject, sac_description: sacDesc },
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
    // No hasGenerated reset needed — user decides when to generate
  }

  function removeVehicle(vehicleId: number) {
    setVehicles(draft.vehicles.filter(v => v.vehicle_id !== vehicleId))
  }

  function toggleInclude(vehicleId: number) {
    setVehicles(draft.vehicles.map(v =>
      v.vehicle_id === vehicleId ? { ...v, include_in_description: !v.include_in_description } : v
    ))
  }

  const charOverLimit        = charCount > CHAR_LIMIT
  const hasDescription       = draft.overall_description.trim().length > 0
  const isAiWorking          = generating || refining

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
              No vehicles added. Optional — vehicles marked "Include" will be mentioned in the description.
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
        {/* Section label */}
        <span style={{
          fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
          display: 'block', marginBottom: 10,
        }}>
          ✍️ Description of Services
        </span>

        {/* Textarea — always visible and editable */}
        {generating ? (
          <div style={{ ...cardStyle, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: 'var(--color-text-faint)', fontSize: 14 }}>✨ Generating description…</span>
          </div>
        ) : (
          <>
            <textarea
              ref={descRef}
              rows={5}
              value={draft.overall_description}
              onChange={e => {
                patch({ overall_description: e.target.value })
                setCharCount(e.target.value.length)
              }}
              placeholder="Write the description yourself, or use one of the AI options below."
              style={{
                ...inputStyle,
                resize: 'vertical',
                lineHeight: 1.6,
                marginBottom: 4,
                borderColor: charOverLimit ? 'var(--color-warning)' : undefined,
              }}
            />
            <div style={{
              textAlign: 'right', fontSize: 11, marginBottom: 16,
              color: charOverLimit ? 'var(--color-warning)' : 'var(--color-text-faint)',
              fontWeight: charOverLimit ? 600 : 400,
            }}>
              {charCount}/{CHAR_LIMIT} chars{charOverLimit ? ' — please shorten or ask AI to trim' : ''}
            </div>
          </>
        )}

        {genError && (
          <div style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 12 }}>⚠️ {genError}</div>
        )}

        {/* ── AI Action Row ── */}
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap',
          padding: '12px 14px',
          background: 'var(--color-surface-offset)',
          borderRadius: 12,
          border: '1px solid var(--color-border)',
          marginBottom: 16,
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-faint)', marginRight: 4 }}>✨ AI</span>

          {/* Generate with AI — only shown when description is empty */}
          {!hasDescription && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isAiWorking}
              style={{
                padding: '7px 16px', borderRadius: 20,
                border: '1.5px solid var(--color-accent)',
                background: 'var(--color-accent)', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: isAiWorking ? 'not-allowed' : 'pointer',
                opacity: isAiWorking ? 0.6 : 1,
              }}
            >
              {generating ? '⌛ Generating…' : '✨ Generate with AI'}
            </button>
          )}

          {/* Regenerate — only shown when description already has content */}
          {hasDescription && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isAiWorking}
              style={{
                padding: '7px 16px', borderRadius: 20,
                border: '1.5px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-text-muted)',
                fontSize: 13, fontWeight: 600, cursor: isAiWorking ? 'not-allowed' : 'pointer',
                opacity: isAiWorking ? 0.6 : 1,
              }}
            >
              {generating ? '⌛ Regenerating…' : '↺ Regenerate'}
            </button>
          )}
        </div>

        {/* ── Improve with AI (refinement) ── */}
        <div style={{ marginTop: 4 }}>
          <label style={labelStyle}>Improve with AI — describe your edit</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={refinement}
              onChange={e => setRefinement(e.target.value)}
              placeholder="e.g. Make it more formal / Remove vehicle names / Shorten it"
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRefine() } }}
            />
            <button
              type="button"
              onClick={handleRefine}
              disabled={refining || !refinement.trim() || !hasDescription}
              title={!hasDescription ? 'Write or generate a description first' : ''}
              style={{
                padding: '0 18px', borderRadius: 12, border: 'none',
                background: (refinement.trim() && hasDescription) ? 'var(--color-accent)' : 'var(--color-border)',
                color: '#fff', fontWeight: 600, fontSize: 14,
                cursor: (refinement.trim() && hasDescription) ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                opacity: (!refinement.trim() || !hasDescription) ? 0.5 : 1,
              }}
            >
              {refining ? '…' : 'Apply'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-faint)', marginTop: 6 }}>
            Tip: description should be under {CHAR_LIMIT} characters. Ask AI to "trim to under {CHAR_LIMIT} characters" if needed.
          </p>
        </div>
      </div>
    </div>
  )
}
