import { useState } from 'react'
import type { Vehicle } from '../../db/types'
import { upsertVehicle } from '../../db/vehiclesDb'
import { Field, PrimaryButton, sectionTitleStyle } from '../settings/_components'

interface Props {
  vehicle?: Vehicle | null
  onClose: () => void
  onSaved: () => void
}

export default function VehicleFormModal({ vehicle, onClose, onSaved }: Props) {
  const isEdit = !!vehicle

  const [regNumber,    setRegNumber]    = useState(vehicle?.reg_number ?? '')
  const [vehicleType,  setVehicleType]  = useState(vehicle?.vehicle_type ?? '')
  const [capacity,     setCapacity]     = useState(vehicle?.capacity?.toString() ?? '')
  const [capacityUnit, setCapacityUnit] = useState(vehicle?.capacity_unit ?? '')
  const [monthlyRent,  setMonthlyRent]  = useState(vehicle?.default_monthly_rent?.toString() ?? '')
  const [notes,        setNotes]        = useState(vehicle?.notes ?? '')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function handleSave() {
    const reg = regNumber.trim().toUpperCase()
    if (!reg) { setError('Registration number is required'); return }

    setSaving(true); setError(null)

    const payload: Partial<Vehicle> & { reg_number: string } = {
      id:                   vehicle?.id,
      reg_number:           reg,
      vehicle_type:         vehicleType.trim() || null,
      capacity:             capacity.trim() ? parseFloat(capacity) : null,
      capacity_unit:        capacityUnit.trim() || null,
      default_monthly_rent: monthlyRent.trim() ? parseFloat(monthlyRent) : null,
      notes:                notes.trim() || null,
      is_active:            true,
    }

    const saved = await upsertVehicle(payload)
    if (!saved) { setError('Failed to save vehicle. Please try again.'); setSaving(false); return }

    setSaving(false)
    onSaved()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(30,20,10,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 200,
    }}>
      <div
        className="sheet-enter"
        style={{
          background: 'var(--color-bg)',
          borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: '640px',
          maxHeight: '92svh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >

        {/* Header */}
        <div style={{ background: 'var(--color-primary)', padding: '12px 20px 16px', borderRadius: '20px 20px 0 0', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: 'var(--color-bg)', fontSize: '20px', fontFamily: 'Playfair Display, serif' }}>
              {isEdit ? 'Edit Vehicle' : 'New Vehicle'}
            </h2>
            <button type="button" onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'var(--color-bg)', fontSize: '18px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 20px' }}>

          {error && (
            <div style={{ background: 'rgba(139,46,46,0.08)', border: '1px solid var(--color-error)', color: 'var(--color-error)', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <p style={sectionTitleStyle}>Vehicle Identity</p>
          <Field
            label="Registration Number *"
            value={regNumber}
            onChange={v => setRegNumber(v.toUpperCase())}
            placeholder="e.g. AP39TC1234"
            required
          />
          <Field
            label="Vehicle Type"
            value={vehicleType}
            onChange={setVehicleType}
            placeholder="e.g. Tipper, Dumper, JCB"
          />

          <p style={{ ...sectionTitleStyle, marginTop: '8px' }}>Capacity (optional)</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-faint)', marginBottom: '14px', lineHeight: 1.5 }}>
            Physical spec of the vehicle. Fill later if not known now.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Capacity" value={capacity} onChange={setCapacity} placeholder="e.g. 6" type="number" />
            <Field label="Capacity Unit" value={capacityUnit} onChange={setCapacityUnit} placeholder="e.g. CUM, TON" />
          </div>

          <p style={{ ...sectionTitleStyle, marginTop: '8px' }}>Rental Info (optional)</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-faint)', marginBottom: '14px', lineHeight: 1.5 }}>
            Default monthly rent — used as a pre-fill hint in rental invoices. Can be overridden per invoice.
          </p>
          <Field label="Default Monthly Rent (₹)" value={monthlyRent} onChange={setMonthlyRent} placeholder="e.g. 85000" type="number" />

          <p style={{ ...sectionTitleStyle, marginTop: '8px' }}>Notes</p>
          <div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes about this vehicle…"
              rows={3}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '15px', fontFamily: 'Work Sans, sans-serif', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0, display: 'flex', gap: '12px' }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '16px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Cancel</button>
          <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Vehicle'}</PrimaryButton>
        </div>
      </div>
    </div>
  )
}
