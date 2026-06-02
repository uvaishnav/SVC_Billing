// Shared styled primitives — UI/CSS only, no business logic
import React from 'react'

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '10px',
  border: '1.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: '16px',  // 16px prevents iOS auto-zoom
  outline: 'none',
  fontFamily: 'Work Sans, sans-serif',
  WebkitAppearance: 'none',
  transition: 'border-color 180ms cubic-bezier(0.25,0,0.3,1), box-shadow 180ms cubic-bezier(0.25,0,0.3,1)',
}

export const inputFocusStyle: React.CSSProperties = {
  borderColor: 'rgba(200,169,106,0.7)',
  boxShadow: '0 0 0 3px rgba(200,169,106,0.15)',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  marginBottom: '6px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.7px',
}

export const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid rgba(217,211,197,0.55)',
  borderRadius: '14px',
  padding: '16px',
  boxShadow: '0 1px 4px rgba(59,42,31,0.08), 0 2px 8px rgba(59,42,31,0.04)',
}

export const sectionTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase' as const,
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

  const dynamicStyle: React.CSSProperties = focused
    ? { ...inputStyle, borderColor: 'rgba(200,169,106,0.7)', boxShadow: '0 0 0 3px rgba(200,169,106,0.15)' }
    : { ...inputStyle }

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
          style={{ ...dynamicStyle, resize: 'none', lineHeight: 1.5 }}
        />
      ) : (
        <input
          type={type} required={required} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={dynamicStyle}
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
      className={disabled ? undefined : 'btn-primary'}
      style={disabled ? {
        width: '100%', minHeight: '50px', padding: '14px 20px',
        background: 'var(--color-text-faint)',
        color: 'var(--color-bg)', fontWeight: 600, fontSize: '15px',
        borderRadius: '10px', border: 'none', cursor: 'not-allowed',
        fontFamily: 'Work Sans, sans-serif',
      } : undefined}
    >
      {children}
    </button>
  )
}

export function SavedBadge() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      color: 'var(--color-success)', fontSize: '13px', fontWeight: 600, marginTop: '8px',
    }}>
      <span style={{ fontSize: '16px' }}>✓</span> Saved successfully
    </div>
  )
}
