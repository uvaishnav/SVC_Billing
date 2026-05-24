import React from 'react'
import type { Vehicle } from '../../db/types'
import { cardStyle } from '../settings/_components'

interface Props {
  vehicle: Vehicle
  onTap: (vehicle: Vehicle) => void
  onEdit: (vehicle: Vehicle) => void
  onDeactivate: (id: number) => void
}

export default function VehicleCard({ vehicle, onTap, onEdit, onDeactivate }: Props) {
  const hasCapacity = vehicle.capacity != null
  const hasRent     = vehicle.default_monthly_rent != null

  return (
    <div
      onClick={() => onTap(vehicle)}
      style={{ ...cardStyle, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Icon */}
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-surface-offset)', border: '1.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '20px' }}>
          🚛
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-primary)', marginBottom: '5px', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {vehicle.reg_number}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {vehicle.vehicle_type && (
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', background: 'var(--color-surface-offset)', border: '1px solid var(--color-border)', padding: '2px 10px', borderRadius: '20px' }}>
                {vehicle.vehicle_type}
              </span>
            )}
            {hasCapacity && (
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', background: 'var(--color-surface-offset)', border: '1px solid var(--color-border)', padding: '2px 10px', borderRadius: '20px' }}>
                {vehicle.capacity} {vehicle.capacity_unit ?? ''}
              </span>
            )}
            {hasRent && (
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-info)', background: 'rgba(42,95,138,0.08)', padding: '2px 10px', borderRadius: '20px' }}>
                ₹{vehicle.default_monthly_rent?.toLocaleString('en-IN')}/mo
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={() => onEdit(vehicle)}
            style={{ padding: '6px 14px', background: 'var(--color-surface-offset)', color: 'var(--color-info)', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer', minHeight: '36px' }}
          >Edit</button>
          <button
            onClick={() => onDeactivate(vehicle.id)}
            style={{ padding: '6px 14px', background: '#FDF0F0', color: 'var(--color-error)', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer', minHeight: '36px' }}
          >Remove</button>
        </div>
      </div>
    </div>
  )
}
