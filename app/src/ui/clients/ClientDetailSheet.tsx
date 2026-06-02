import React from 'react'
import type { ClientWithGstins } from '../../db/types'
import { cardStyle, sectionTitleStyle } from '../settings/_components'

interface Props {
  client: ClientWithGstins
  onClose: () => void
  onEdit: (client: ClientWithGstins) => void
}

export default function ClientDetailSheet({ client, onClose, onEdit }: Props) {
  const primaryGstin = client.gstins.find(g => g.is_primary) ?? client.gstins[0]

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(30,20,10,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 200,
    }}
      onClick={onClose}  // tap backdrop to close
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)',
          borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: '640px',
          maxHeight: '88svh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ background: 'var(--color-primary)', padding: '12px 20px 20px', borderRadius: '20px 20px 0 0', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', margin: '0 auto 16px' }} />

          {/* Avatar + name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              background: 'rgba(200,169,106,0.2)',
              border: '2px solid var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: '20px', fontWeight: 700,
              color: 'var(--color-accent)', fontFamily: 'Playfair Display, serif',
            }}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ color: 'var(--color-text-inverse)', fontSize: '20px', fontFamily: 'Playfair Display, serif', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {client.name}
              </h2>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {client.phone && <span style={{ fontSize: '13px', color: 'var(--color-accent)', opacity: 0.9 }}>{client.phone}</span>}
                {client.email && <span style={{ fontSize: '13px', color: 'var(--color-text-faint)' }}>{client.email}</span>}
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'var(--color-text-inverse)', fontSize: '18px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 20px' }}>

          {/* Summary chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', background: 'var(--color-surface-offset)', border: '1px solid var(--color-border)', padding: '4px 12px', borderRadius: '20px' }}>
              {client.gstins.length} GSTIN{client.gstins.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', background: 'var(--color-surface-offset)', border: '1px solid var(--color-border)', padding: '4px 12px', borderRadius: '20px' }}>
              {client.gstins.length > 0 ? client.gstins.map(g => g.state).join(', ') : 'No states'}
            </span>
          </div>

          {/* GST Registrations */}
          <p style={sectionTitleStyle}>GST Registrations</p>

          {client.gstins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-faint)', fontSize: '14px' }}>No GSTINs on record</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {client.gstins.map(g => (
                <div key={g.id} style={{ ...cardStyle, padding: '14px 16px', border: g.is_primary ? '2px solid var(--color-accent)' : undefined }}>

                  {/* GSTIN + badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <p style={{ fontSize: '15px', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--color-primary)', margin: 0, letterSpacing: '0.5px' }}>
                      {g.gstin}
                    </p>
                    {g.is_primary && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff', background: 'var(--color-success)', padding: '2px 8px', borderRadius: '20px' }}>PRIMARY</span>
                    )}
                  </div>

                  {/* State + address */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-accent)', background: 'rgba(200,169,106,0.12)', border: '1px solid var(--color-accent)', padding: '2px 10px', borderRadius: '20px', flexShrink: 0 }}>
                      {g.state_code} · {g.state}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                    {g.address}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0, display: 'flex', gap: '12px' }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '16px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Close</button>
          <button type="button" onClick={() => { onClose(); onEdit(client) }} style={{ flex: 2, padding: '16px', background: 'var(--color-primary)', color: 'var(--color-text-inverse)', fontWeight: 600, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Edit Client</button>
        </div>
      </div>
    </div>
  )
}
