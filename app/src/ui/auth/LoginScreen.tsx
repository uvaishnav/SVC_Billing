import { useState } from 'react'
import { supabase } from '../../db/supabaseClient'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `calc(32px + var(--safe-top)) calc(24px + var(--safe-right)) calc(32px + var(--safe-bottom)) calc(24px + var(--safe-left))`,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {/* ── Brand header ── */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {/* Logo mark */}
          <div
            style={{
              width: '60px',
              height: '60px',
              background: 'var(--color-primary)',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(59, 42, 31, 0.25)',
            }}
          >
            <span
              style={{
                color: 'var(--color-accent)',
                fontSize: '26px',
                fontWeight: 700,
                fontFamily: 'DM Serif Display, Georgia, serif',
                lineHeight: 1,
              }}
            >
              S
            </span>
          </div>

          <h1
            style={{
              fontSize: '26px',
              fontWeight: 400,
              color: 'var(--color-primary)',
              fontFamily: 'DM Serif Display, Georgia, serif',
              lineHeight: 1.15,
              marginBottom: '8px',
            }}
          >
            Sri Vaishnav
            <br />
            Constructions
          </h1>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            GST Billing
          </p>
        </div>

        {/* ── Card ── */}
        <div
          style={{
            background: 'var(--color-surface-2)',
            borderRadius: '24px',
            padding: '32px 28px',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="login-email"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                }}
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input-premium"
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '28px' }}>
              <label
                htmlFor="login-password"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-premium"
                  style={{ paddingRight: '52px' } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-faint)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: '4px',
                    minHeight: 'unset',
                    minWidth: 'unset',
                  }}
                >
                  {showPw ? '👁' : '🔒'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                style={{
                  background: 'var(--color-error-highlight)',
                  border: '1px solid rgba(139, 46, 46, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  color: 'var(--color-error)',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px',
                background: loading
                  ? 'var(--color-text-muted)'
                  : 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
                fontWeight: 600,
                fontSize: '16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                letterSpacing: '0.2px',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(59, 42, 31, 0.3)',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
