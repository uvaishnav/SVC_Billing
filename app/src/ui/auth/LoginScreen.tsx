import React, { useState } from 'react'
import { supabase } from '../../db/supabaseClient'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F5F1E8] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="font-['Playfair_Display'] text-2xl font-bold text-[#3B2A1F]">
            Sri Vaishnav Constructions
          </h1>
          <p className="text-sm text-[#7A6A58] mt-1">GST Billing App</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3B2A1F] mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#D9D3C5] bg-[#FAF8F3] text-[#2A1F15] focus:outline-none focus:ring-2 focus:ring-[#C8A96A] text-base"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3B2A1F] mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#D9D3C5] bg-[#FAF8F3] text-[#2A1F15] focus:outline-none focus:ring-2 focus:ring-[#C8A96A] text-base"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p className="text-sm text-[#8B2E2E] bg-[#FDF0F0] px-4 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#3B2A1F] text-[#F5F1E8] font-semibold rounded-xl text-base active:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
