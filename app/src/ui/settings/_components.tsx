// Shared styled primitives for the Settings module
import React from 'react'

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '12px',
  border: '1.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '16px',
  outline: 'none',
  fontFamily: 'Work Sans, sans-serif',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

export const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface-2)',
  border: '1.5px solid var(--color-border)',
  borderRadius: '16px',
  padding: '16px',
}

export const sectionTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  marginBottom: '12px',
}

export function Field({
  label, value, onChange, placeholder, required = false,
  type = 'text', rows,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string; rows?: number
}) {
  const [focused, setFocused] = React.useState(false)
  const borderColor = focused ? 'var(--color-accent)' : 'var(--color-border)'

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: 'var(--color-error)', marginLeft: '4px' }}>*</span>}
      </label>
      {rows ? (
        <textarea
          required={required} value={value} placeholder={placeholder} rows={rows}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...inputStyle, borderColor, resize: 'none', lineHeight: 1.5 }}
        />
      ) : (
        <input
          type={type} required={required} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...inputStyle, borderColor }}
        />
      )}
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      style={{
        width: '100%', padding: '16px', background: disabled ? 'var(--color-text-faint)' : 'var(--color-primary)',
        color: 'var(--color-bg)', fontWeight: 600, fontSize: '16px',
        borderRadius: '12px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Work Sans, sans-serif', transition: 'opacity 0.15s',
      }}
    >
      {children}
    </button>
  )
}

export function SavedBadge() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontSize: '14px', fontWeight: 600, marginTop: '8px' }}>
      <span>✓</span> Saved successfully
    </div>
  )
}
