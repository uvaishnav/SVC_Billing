import React, { useEffect, useState } from 'react'
import { supabase } from '../db/supabaseClient'
import type { Session } from '@supabase/supabase-js'
import LoginScreen from './auth/LoginScreen'
import SettingsPage from './settings/SettingsPage'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    // Listen for login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F1E8] flex items-center justify-center">
        <p className="text-[#7A6A58]">Loading…</p>
      </div>
    )
  }

  if (!session) return <LoginScreen />

  // Temporary: show Settings directly until nav shell is built
  return <SettingsPage />
}
