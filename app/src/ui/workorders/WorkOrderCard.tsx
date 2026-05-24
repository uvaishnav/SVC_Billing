import React from 'react'
import type { WorkOrderWithClient } from '../../db/types'

interface Props {
  workOrder: WorkOrderWithClient
  onTap: (wo: WorkOrderWithClient) => void
  onEdit: (wo: WorkOrderWithClient) => void
  onClose: (id: number) => void
}

const STATUS_CONFIG = {
  active:        { label: 'Active',        bg: 'var(--color-success-highlight)', color: 'var(--color-success)' },
  expiring_soon: { label: 'Expiring Soon', bg: 'var(--color-warning-highlight)', color: 'var(--color-warning)' },
  expired:       { label: 'Expired',       bg: 'var(--color-error-highlight)',   color: 'var(--color-error)' },
  closed:        { label: 'Closed',        bg: 'var(--color-surface-offset)',    color: 'var(--color-text-muted)' },
}

export default function WorkOrderCard({ workOrder: wo, onTap, onEdit, onClose }: Props) {
  const status = STATUS_CONFIG[wo.status] ?? STATUS_CONFIG.active

  function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function formatValue(v: number | null) {
    if (v == null) return '—'
    return '₹' + v.toLocaleString('en-IN')
  }

  function daysLeft() {
    if (!wo.valid_to) return null
    const days = Math.ceil((new Date(wo.valid_to).getTime() - Date.now()) / 86400000)
    return days
  }

  const days = daysLeft()

  return (
    <div
      onClick={() => onTap(wo)}
      style={{
        background: 'var(--color-surface)',
        borderRadius: '14px',
        padding: '16px',
        cursor: 'pointer',
        border: '1px solid var(--color-border)',
        transition: 'box-shadow 0.15s',
        position: 'relative',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            {wo.wo_reference && (
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'Work Sans, sans-serif', letterSpacing: '0.3px' }}>
                {wo.wo_reference}
              </span>
            )}
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px', background: status.bg, color: status.color }}>
              {status.label}
            </span>
            {wo.status === 'expiring_soon' && days !== null && (
              <span style={{ fontSize: '12px', color: 'var(--color-warning)', fontWeight: 500 }}>{days}d left</span>
            )}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-text)', fontWeight: 600, lineHeight: 1.35, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {wo.subject}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {wo.client_name && (
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>👤 {wo.client_name}</span>
        )}
        {wo.project_name && (
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>📁 {wo.project_name}</span>
        )}
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>📅 {formatDate(wo.issue_date)}</span>
        {wo.valid_to && (
          <span style={{ fontSize: '13px', color: wo.status === 'expired' ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
            ⏳ Valid to {formatDate(wo.valid_to)}
          </span>
        )}
        {wo.total_value != null && (
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>💰 {formatValue(wo.total_value)}</span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onEdit(wo)}
          style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--color-accent-highlight)', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}
        >Edit</button>
        {wo.status !== 'closed' && (
          <button
            type="button"
            onClick={() => onClose(wo.id)}
            style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}
          >Close WO</button>
        )}
      </div>
    </div>
  )
}
