import React from 'react'
import type { Vehicle } from '../../db/types'
import { cardStyle, sectionTitleStyle } from '../settings/_components'

interface Props {
  vehicle: Vehicle
  onClose: () => void
  onEdit: (vehicle: Vehicle) => void
}

export default function VehicleDetailSheet({ vehicle, onClose, onEdit }: Props) {
  const hasCapacity = vehicle.capacity != null
  const hasRent     = vehicle.default_monthly_rent != null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(30,20,10,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '640px', maxHeight: '88svh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ background: 'var(--color-primary)', padding: '12px 20px 20px', borderRadius: '20px 20px 0 0', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(200,169,106,0.2)', border: '2px solid var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '22px' }}>
              🚛
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ color: 'var(--color-text-inverse)', fontSize: '20px', fontFamily: 'DM Serif Display, Georgia, serif', marginBottom: '4px', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {vehicle.reg_number}
              </h2>
              {vehicle.vehicle_type && (
                <span style={{ fontSize: '13px', color: 'var(--color-accent)', opacity: 0.9 }}>{vehicle.vehicle_type}</span>
              )}
            </div>
            <button type="button" onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'var(--color-text-inverse)', fontSize: '18px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 20px' }}>

          {/* Summary chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {hasCapacity ? (
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', background: 'var(--color-surface-offset)', border: '1px solid var(--color-border)', padding: '4px 12px', borderRadius: '20px' }}>
                {vehicle.capacity} {vehicle.capacity_unit ?? ''}
              </span>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--color-text-faint)', background: 'var(--color-surface-offset)', border: '1px solid var(--color-border)', padding: '4px 12px', borderRadius: '20px' }}>Capacity not set</span>
            )}
            {hasRent && (
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-info)', background: 'rgba(42,95,138,0.08)', padding: '4px 12px', borderRadius: '20px' }}>
                ₹{vehicle.default_monthly_rent?.toLocaleString('en-IN')}/month
              </span>
            )}
          </div>

          {/* Details section */}
          <p style={sectionTitleStyle}>Vehicle Details</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>

            <div style={{ ...cardStyle, padding: '14px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</p>
                  <p style={{ fontSize: '15px', color: 'var(--color-primary)', fontWeight: 600 }}>{vehicle.vehicle_type ?? '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Capacity</p>
                  <p style={{ fontSize: '15px', color: 'var(--color-primary)', fontWeight: 600 }}>
                    {hasCapacity ? `${vehicle.capacity} ${vehicle.capacity_unit ?? ''}` : '—'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Default Monthly Rent</p>
                  <p style={{ fontSize: '15px', color: 'var(--color-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {hasRent ? `₹${vehicle.default_monthly_rent?.toLocaleString('en-IN')}` : '—'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Added On</p>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                    {new Date(vehicle.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              {vehicle.notes && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</p>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{vehicle.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0, display: 'flex', gap: '12px' }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '16px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Close</button>
          <button type="button" onClick={() => { onClose(); onEdit(vehicle) }} style={{ flex: 2, padding: '16px', background: 'var(--color-primary)', color: 'var(--color-text-inverse)', fontWeight: 600, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Edit Vehicle</button>
        </div>
      </div>
    </div>
  )
}
