import React from 'react'
import type { ClientWithGstins } from '../../db/types'
import { cardStyle } from '../settings/_components'

interface Props {
  client: ClientWithGstins
  onEdit: (client: ClientWithGstins) => void
  onDeactivate: (id: number) => void
}

export default function ClientCard({ client, onEdit, onDeactivate }: Props) {
  const primaryGstin = client.gstins.find(g => g.is_primary) ?? client.gstins[0]

  // Build state label: "AP, Telangana +2 states"
  const stateNames = client.gstins.map(g => g.state)
  const displayStates = stateNames.slice(0, 2).join(', ')
  const extraStates   = stateNames.length > 2 ? stateNames.length - 2 : 0

  return (
    <div style={{ ...cardStyle }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>

        {/* Avatar */}
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%',
          background: 'var(--color-surface-offset)',
          border: '1.5px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: '16px', fontWeight: 700,
          color: 'var(--color-primary)', fontFamily: 'Playfair Display, serif',
        }}>
          {client.name.charAt(0).toUpperCase()}
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-primary)', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {client.name}
          </p>

          {primaryGstin ? (
            <>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {primaryGstin.address}
              </p>
              <p style={{ fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)', letterSpacing: '0.3px', marginBottom: '6px' }}>
                {primaryGstin.gstin}
              </p>
            </>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--color-text-faint)', marginBottom: '6px' }}>No GSTIN added</p>
          )}

          {/* States row */}
          {client.gstins.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{
                fontSize: '12px', fontWeight: 500,
                color: 'var(--color-text-muted)',
                background: 'var(--color-surface-offset)',
                border: '1px solid var(--color-border)',
                padding: '2px 10px', borderRadius: '20px',
              }}>
                {displayStates}
              </span>
              {extraStates > 0 && (
                <span style={{
                  fontSize: '12px', fontWeight: 500,
                  color: 'var(--color-warning)',
                  background: 'rgba(160,92,26,0.08)',
                  padding: '2px 10px', borderRadius: '20px',
                }}>+{extraStates} state{extraStates > 1 ? 's' : ''}</span>
              )}
              {client.phone && (
                <span style={{
                  fontSize: '12px', color: 'var(--color-text-faint)',
                  padding: '2px 10px', borderRadius: '20px',
                  background: 'var(--color-surface-offset)',
                  border: '1px solid var(--color-border)',
                }}>{client.phone}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => onEdit(client)}
            style={{ padding: '6px 14px', background: 'var(--color-surface-offset)', color: 'var(--color-info)', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer', minHeight: '36px' }}
          >Edit</button>
          <button onClick={() => onDeactivate(client.id)}
            style={{ padding: '6px 14px', background: '#FDF0F0', color: 'var(--color-error)', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer', minHeight: '36px' }}
          >Remove</button>
        </div>
      </div>
    </div>
  )
}
