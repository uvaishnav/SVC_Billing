import React, { useEffect, useRef, useState } from 'react'
import type { InvoiceDraft, InvoiceVehicleDraft, Vehicle } from '../../db/types'
import { generateInvoiceDescription, buildDescriptionPayload } from './invoiceDescriptionHelper'

interface Props {
  draft: InvoiceDraft
  allVehicles: Vehicle[]
  clientName: string
  woSubject?: string
  woReference?: string
  onChange: (patch: Partial<InvoiceDraft>) => void
  onNext: () => void
  onBack: () => void
}

export default function Section3Description({
  draft, allVehicles, clientName, woSubject, woReference, onChange, onNext, onBack,
}: Props) {
  const [generating, setGenerating] = useState(false)
  const [refinementInput, setRefinementInput] = useState('')
  const [showVehiclePicker, setShowVehiclePicker] = useState(false)
  const [charCount, setCharCount] = useState(draft.overall_description?.length ?? 0)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const hasGenerated = useRef(false)

  // Auto-generate on first entry if description is empty
  useEffect(() => {
    if (!hasGenerated.current && !draft.overall_description && draft.line_items.length > 0) {
      hasGenerated.current = true
      handleGenerate()
    }
  }, [])

  async function handleGenerate(refinement?: string) {
    setGenerating(true)
    const payload = buildDescriptionPayload(draft, clientName, woSubject, woReference, refinement)
    const result  = await generateInvoiceDescription(payload)
    setGenerating(false)
    if (result) {
      onChange({ overall_description: result })
      setCharCount(result.length)
      setRefinementInput('')
    }
  }

  function handleDescriptionEdit(val: string) {
    onChange({ overall_description: val })
    setCharCount(val.length)
  }

  // Added vehicles (in draft)
  const addedVehicleIds = new Set(draft.vehicles.map(v => v.vehicle_id))

  // Available to add (active, not yet added)
  const availableToAdd = allVehicles.filter(v => v.is_active && !addedVehicleIds.has(v.id))

  function addVehicle(v: Vehicle) {
    const newVehicle: InvoiceVehicleDraft = {
      vehicle_id:             v.id,
      reg_number:             v.reg_number,
      vehicle_type:           v.vehicle_type,
      include_in_description: true,
    }
    onChange({ vehicles: [...draft.vehicles, newVehicle] })
    setShowVehiclePicker(false)
    // Nudge: if description already exists, tell user to regenerate
  }

  function removeVehicle(vehicleId: number) {
    onChange({ vehicles: draft.vehicles.filter(v => v.vehicle_id !== vehicleId) })
  }

  function toggleInclude(vehicleId: number) {
    onChange({
      vehicles: draft.vehicles.map(v =>
        v.vehicle_id === vehicleId ? { ...v, include_in_description: !v.include_in_description } : v
      )
    })
  }

  const isValid = (draft.overall_description?.trim().length ?? 0) > 0

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Vehicles Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            🚛 Vehicles Involved
          </span>
          <button
            type='button'
            onClick={() => setShowVehiclePicker(!showVehiclePicker)}
            style={{
              padding: '6px 12px',
              background: 'rgba(200,169,106,0.1)',
              border: '1px solid rgba(200,169,106,0.3)',
              borderRadius: '8px',
              color: 'var(--color-accent)',
              fontSize: '12px', fontWeight: 600,
              fontFamily: 'Work Sans, sans-serif',
              cursor: 'pointer',
            }}
          >
            + Add Vehicle
          </button>
        </div>

        {/* Vehicle Picker */}
        {showVehiclePicker && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(200,169,106,0.2)',
            borderRadius: '10px',
            padding: '10px',
            marginBottom: '10px',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            {availableToAdd.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-faint)', textAlign: 'center', padding: '8px' }}>
                All active vehicles added
              </div>
            ) : availableToAdd.map(v => (
              <button
                key={v.id}
                type='button'
                onClick={() => addVehicle(v)}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(200,169,106,0.15)',
                  borderRadius: '8px',
                  color: 'var(--color-text)',
                  fontSize: '13px', textAlign: 'left',
                  fontFamily: 'Work Sans, sans-serif',
                  cursor: 'pointer',
                }}
              >
                🚛 {v.reg_number}
                {v.vehicle_type && <span style={{ color: 'var(--color-text-faint)', marginLeft: '6px' }}>({v.vehicle_type})</span>}
              </button>
            ))}
          </div>
        )}

        {/* Added Vehicles */}
        {draft.vehicles.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {draft.vehicles.map(v => (
              <div key={v.vehicle_id} style={{
                padding: '10px 12px',
                background: 'rgba(200,169,106,0.06)',
                border: '1px solid rgba(200,169,106,0.2)',
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text)', fontFamily: 'Work Sans, sans-serif' }}>
                  🚛 {v.reg_number}
                  {v.vehicle_type && <span style={{ color: 'var(--color-text-faint)' }}> ({v.vehicle_type})</span>}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-faint)', cursor: 'pointer' }}>
                  <input
                    type='checkbox'
                    checked={v.include_in_description}
                    onChange={() => toggleInclude(v.vehicle_id)}
                    style={{ accentColor: 'var(--color-accent)' }}
                  />
                  In desc
                </label>
                <button
                  type='button'
                  onClick={() => removeVehicle(v.vehicle_id)}
                  style={{ background: 'none', border: 'none', color: '#dc503c', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
                >×</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--color-text-faint)', padding: '8px 0', fontFamily: 'Work Sans, sans-serif' }}>
            No vehicles added yet — optional for tracking and description.
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(200,169,106,0.15)' }} />

      {/* Description */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-faint)', fontFamily: 'Work Sans, sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            ✨ Overall Description
          </span>
          <button
            type='button'
            onClick={() => handleGenerate()}
            disabled={generating}
            style={{
              padding: '6px 12px',
              background: 'rgba(200,169,106,0.1)',
              border: '1px solid rgba(200,169,106,0.3)',
              borderRadius: '8px',
              color: generating ? 'var(--color-text-faint)' : 'var(--color-accent)',
              fontSize: '12px', fontWeight: 600,
              fontFamily: 'Work Sans, sans-serif',
              cursor: generating ? 'default' : 'pointer',
            }}
          >
            {generating ? 'Generating…' : '↺ Regenerate'}
          </button>
        </div>

        {generating ? (
          <div style={{
            height: '100px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-faint)', fontSize: '13px',
            fontFamily: 'Work Sans, sans-serif',
          }}>
            ✨ Writing description…
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <textarea
              ref={descRef}
              value={draft.overall_description}
              onChange={e => handleDescriptionEdit(e.target.value)}
              rows={5}
              placeholder='Description will be generated here…'
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(200,169,106,0.2)',
                borderRadius: '10px',
                color: 'var(--color-text)',
                fontSize: '14px',
                fontFamily: 'Work Sans, sans-serif',
                resize: 'vertical',
                lineHeight: '1.5',
              }}
            />
            <div style={{
              textAlign: 'right', fontSize: '11px',
              color: charCount > 300 ? '#dc503c' : 'var(--color-text-faint)',
              fontFamily: 'Work Sans, sans-serif',
              marginTop: '4px',
            }}>
              {charCount}/300 chars
            </div>
          </div>
        )}
      </div>

      {/* Refinement */}
      <div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '8px', fontFamily: 'Work Sans, sans-serif' }}>
          💬 How should I edit this?
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type='text'
            value={refinementInput}
            onChange={e => setRefinementInput(e.target.value)}
            placeholder='e.g. Make it more formal / Add vehicle count…'
            style={{
              flex: 1, padding: '10px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(200,169,106,0.2)',
              borderRadius: '8px',
              color: 'var(--color-text)',
              fontSize: '13px',
              fontFamily: 'Work Sans, sans-serif',
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && refinementInput.trim()) handleGenerate(refinementInput.trim())
            }}
          />
          <button
            type='button'
            disabled={!refinementInput.trim() || generating}
            onClick={() => handleGenerate(refinementInput.trim())}
            style={{
              padding: '10px 14px',
              background: refinementInput.trim() ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
              color: refinementInput.trim() ? 'var(--color-primary)' : 'var(--color-text-faint)',
              border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 700,
              fontFamily: 'Work Sans, sans-serif',
              cursor: refinementInput.trim() ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            Apply →
          </button>
        </div>
      </div>

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
        }}>Next → Review ✅</button>
      </div>
    </div>
  )
}
