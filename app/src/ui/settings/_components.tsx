/**
 * _components.tsx — Shared styled primitives for the Settings module
 * and widely used across the app.
 *
 * Design tokens: use CSS variables from index.css only.
 * Font: Work Sans body, DM Serif Display headings.
 */
import React from 'react'

// ─── Style Objects ─────────────────────────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
  width:        '100%',
  padding:      '14px 16px',
  borderRadius: 'var(--radius-md)',
  border:       '1.5px solid var(--color-border)',
  background:   'var(--color-surface)',
  color:        'var(--color-text)',
  fontSize:     '16px',
  outline:      'none',
  fontFamily:   'Work Sans, system-ui, sans-serif',
  transition:   'border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out)',
}

export const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      '12px',
  fontWeight:    600,
  color:         'var(--color-text-muted)',
  marginBottom:  '7px',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}

export const cardStyle: React.CSSProperties = {
  background:   'var(--color-surface-2)',
  border:       '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding:      '16px',
  boxShadow:    'var(--shadow-sm)',
}

export const sectionTitleStyle: React.CSSProperties = {
  fontSize:      '11px',
  fontWeight:    700,
  color:         'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.9px',
  marginBottom:  '12px',
}

// ─── Field Component ───────────────────────────────────────────────────────────

export function Field({
  label, value, onChange, placeholder, required = false,
  type = 'text', rows,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  type?: string
  rows?: number
}) {
  const [focused, setFocused] = React.useState(false)

  const focusedStyle: React.CSSProperties = focused
    ? { borderColor: 'var(--color-accent)', boxShadow: '0 0 0 3px rgba(200, 169, 106, 0.18)' }
    : {}

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: 'var(--color-error)', marginLeft: '4px' }}>*</span>}
      </label>
      {rows ? (
        <textarea
          required={required}
          value={value}
          placeholder={placeholder}
          rows={rows}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...inputStyle, ...focusedStyle, resize: 'none', lineHeight: 1.5 }}
        />
      ) : (
        <input
          type={type}
          required={required}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...inputStyle, ...focusedStyle }}
        />
      )}
    </div>
  )
}

// ─── PrimaryButton ────────────────────────────────────────────────────────────

export function PrimaryButton({
  children, onClick, disabled, type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width:        '100%',
        padding:      '16px',
        background:   disabled ? 'var(--color-text-faint)' : 'var(--color-primary)',
        color:        'var(--color-text-inverse)',
        fontWeight:   600,
        fontSize:     '16px',
        borderRadius: 'var(--radius-md)',
        border:       'none',
        fontFamily:   'Work Sans, system-ui, sans-serif',
        boxShadow:    disabled ? 'none' : '0 4px 14px rgba(59, 42, 31, 0.25)',
        letterSpacing:'0.2px',
      }}
    >
      {children}
    </button>
  )
}

// ─── SavedBadge ───────────────────────────────────────────────────────────────

export function SavedBadge() {
  return (
    <div
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        '6px',
        color:      'var(--color-success)',
        fontSize:   '14px',
        fontWeight: 600,
        marginTop:  '10px',
        padding:    '6px 12px',
        background: 'var(--color-success-highlight)',
        borderRadius:'var(--radius-sm)',
      }}
    >
      ✓ Saved successfully
    </div>
  )
}
