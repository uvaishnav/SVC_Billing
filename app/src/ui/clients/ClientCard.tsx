import React from 'react'
import type { ClientWithGstins } from '../../db/types'
import { cardStyle } from '../settings/_components'

interface Props {
  client: ClientWithGstins
  onEdit: (client: ClientWithGstins) => void
  onDeactivate: (id: number) => void
}

export default function ClientCard({ client, onEdit, onDeactivate }: Props) {
  const stateNames   = client.gstins.map(g => g.state)
  const displayStates = stateNames.slice(0, 2).join(', ')
  const extraStates   = stateNames.length > 2 ? stateNames.length - 2 : 0
  const gstinCount    = client.gstins.length

  return (
    <div style={{ ...cardStyle }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Avatar */}
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: 'var(--color-surface-offset)',
          border: '1.5px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: '17px', fontWeight: 700,
          color: 'var(--color-primary)', fontFamily: 'Playfair Display, serif',
        }}>
          {client.name.charAt(0).toUpperCase()}
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name */}
          <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-primary)', marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {client.name}
          </p>

          {/* Pills row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>

            {/* States */}
            {gstinCount > 0 && (
              <span style={{
                fontSize: '12px', fontWeight: 500,
                color: 'var(--color-text-muted)',
                background: 'var(--color-surface-offset)',
                border: '1px solid var(--color-border)',
                padding: '2px 10px', borderRadius: '20px',
              }}>
                {displayStates}{extraStates > 0 ? `, +${extraStates} state${extraStates > 1 ? 's' : ''}` : ''}
              </span>
            )}

            {/* GSTIN count */}
            {gstinCount > 0 && (
              <span style={{
                fontSize: '12px', fontWeight: 500,
                color: 'var(--color-info)',
                background: 'rgba(42,95,138,0.08)',
                padding: '2px 10px', borderRadius: '20px',
              }}>
                {gstinCount} GSTIN{gstinCount > 1 ? 's' : ''}
              </span>
            )}

            {gstinCount === 0 && (
              <span style={{
                fontSize: '12px', color: 'var(--color-text-faint)',
                padding: '2px 10px', borderRadius: '20px',
                background: 'var(--color-surface-offset)',
                border: '1px solid var(--color-border)',
              }}>No GSTIN</span>
            )}

            {/* Phone */}
            {client.phone && (
              <span style={{
                fontSize: '12px', color: 'var(--color-text-faint)',
                padding: '2px 10px', borderRadius: '20px',
                background: 'var(--color-surface-offset)',
                border: '1px solid var(--color-border)',
              }}>{client.phone}</span>
            )}
          </div>
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
