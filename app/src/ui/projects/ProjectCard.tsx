import React from 'react'
import type { ProjectWithClient } from '../../db/types'

interface Props {
  project: ProjectWithClient
  onEdit: (p: ProjectWithClient) => void
  onDeactivate: (id: number) => void
}

export default function ProjectCard({ project: p, onEdit, onDeactivate }: Props) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '14px', padding: '16px', border: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px', fontFamily: 'Playfair Display, serif' }}>{p.name}</p>
          {p.site_location && (
            <p style={{ fontSize: '13px', color: 'var(--color-accent)', margin: '0 0 4px', fontWeight: 500 }}>📍 {p.site_location}</p>
          )}
          {p.client_name && (
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>👤 {p.client_name}</p>
          )}
        </div>
        <div style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '20px', background: 'var(--color-info-highlight)', color: 'var(--color-info)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {p.place_of_supply} · {p.state_code}
        </div>
      </div>
      {p.full_subject && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.45, margin: '0 0 12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {p.full_subject}
        </p>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => onEdit(p)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--color-accent-highlight)', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Edit</button>
        <button type="button" onClick={() => onDeactivate(p.id)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Archive</button>
      </div>
    </div>
  )
}
