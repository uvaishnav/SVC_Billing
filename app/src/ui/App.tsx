import { useEffect, useState } from 'react'
import { supabase } from '../db/supabaseClient'
import type { Session } from '@supabase/supabase-js'
import LoginScreen from './auth/LoginScreen'
import AppShell from './AppShell'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
        {/* Safe-area solid header skeleton matches page-header */}
        <div style={{
          background: 'var(--color-bg)',
          paddingTop: 'calc(max(var(--safe-top, 0px), 10px) + 6px)',
          paddingBottom: '10px',
          paddingLeft: '16px',
          paddingRight: '16px',
          borderBottom: '1px solid rgba(59, 42, 31, 0.08)',
        }}>
          <div style={{ height: '24px', width: '120px', background: 'rgba(59,42,31,0.08)', borderRadius: '6px' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <span style={{ color: 'var(--color-accent)', fontSize: '24px', fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>S</span>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 500 }}>Loading…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!session) return <LoginScreen />

  return <AppShell />
}
