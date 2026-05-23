import React, { useState, useEffect } from 'react'
import type { ClientWithGstins, ClientGstin } from '../../db/types'
import { upsertClient, upsertClientGstin, deleteClientGstin, setPrimaryGstin } from '../../db/clientsDb'

const AP_STATES = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Telangana', code: '36' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Karnataka', code: '29' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Delhi', code: '07' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'West Bengal', code: '19' },
  { name: 'Gujarat', code: '24' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Other', code: '99' },
]

interface Props {
  client?: ClientWithGstins | null
  onClose: () => void
  onSaved: () => void
}

export default function ClientFormModal({ client, onClose, onSaved }: Props) {
  const isEdit = !!client

  const [name, setName] = useState(client?.name ?? '')
  const [address, setAddress] = useState(client?.address ?? '')
  const [state, setState] = useState(client?.state ?? 'Andhra Pradesh')
  const [stateCode, setStateCode] = useState(client?.state_code ?? '37')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [gstins, setGstins] = useState<Partial<ClientGstin>[]>(
    client?.gstins ?? []
  )
  const [newGstin, setNewGstin] = useState('')
  const [newGstinState, setNewGstinState] = useState('Andhra Pradesh')
  const [newGstinCode, setNewGstinCode] = useState('37')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleStateChange(stateName: string) {
    setState(stateName)
    const found = AP_STATES.find(s => s.name === stateName)
    setStateCode(found?.code ?? '99')
  }

  function handleGstinStateChange(stateName: string) {
    setNewGstinState(stateName)
    const found = AP_STATES.find(s => s.name === stateName)
    setNewGstinCode(found?.code ?? '99')
  }

  async function handleSave() {
    if (!name.trim()) { setError('Client name is required'); return }
    if (!address.trim()) { setError('Address is required'); return }
    setSaving(true)
    setError(null)

    const saved = await upsertClient({
      id: client?.id,
      name: name.trim(),
      address: address.trim(),
      state,
      state_code: stateCode,
      phone: phone.trim() || null,
      email: email.trim() || null,
      is_active: true,
    })
    if (!saved) { setError('Failed to save client. Please try again.'); setSaving(false); return }

    // Handle GSTIN additions that are new (no id yet)
    for (const g of gstins) {
      if (!g.id && g.gstin) {
        await upsertClientGstin({
          client_id: saved.id,
          gstin: g.gstin,
          state: g.state ?? state,
          state_code: g.state_code ?? stateCode,
          is_primary: g.is_primary ?? false,
        })
      }
    }

    setSaving(false)
    onSaved()
  }

  function addGstin() {
    if (!newGstin.trim()) return
    const isPrimary = gstins.length === 0
    setGstins(prev => [...prev, {
      gstin: newGstin.trim().toUpperCase(),
      state: newGstinState,
      state_code: newGstinCode,
      is_primary: isPrimary,
    }])
    setNewGstin('')
  }

  async function removeGstin(index: number) {
    const g = gstins[index]
    if (g.id) await deleteClientGstin(g.id)
    setGstins(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-[#F5F1E8] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#C8A96A]/30">
          <h2 className="text-lg font-semibold text-[#3B2A1F] font-[Playfair_Display]"
          >{isEdit ? 'Edit Client' : 'New Client'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#C8A96A]/20 text-[#7A6A58]">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <p className="text-sm text-[#8B2E2E] bg-[#8B2E2E]/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[#7A6A58] mb-1">Client Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. RSV Constructions Pvt Ltd"
              className="w-full rounded-xl border border-[#C8A96A]/40 bg-white px-3 py-2.5 text-sm text-[#3B2A1F] focus:outline-none focus:ring-2 focus:ring-[#C8A96A]"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-[#7A6A58] mb-1">Address *</label>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={2}
              placeholder="Street, City, PIN"
              className="w-full rounded-xl border border-[#C8A96A]/40 bg-white px-3 py-2.5 text-sm text-[#3B2A1F] focus:outline-none focus:ring-2 focus:ring-[#C8A96A] resize-none"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-xs font-medium text-[#7A6A58] mb-1">Primary State</label>
            <select
              value={state}
              onChange={e => handleStateChange(e.target.value)}
              className="w-full rounded-xl border border-[#C8A96A]/40 bg-white px-3 py-2.5 text-sm text-[#3B2A1F] focus:outline-none focus:ring-2 focus:ring-[#C8A96A]"
            >
              {AP_STATES.map(s => (
                <option key={s.code} value={s.name}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7A6A58] mb-1">Phone</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 99999 00000"
                className="w-full rounded-xl border border-[#C8A96A]/40 bg-white px-3 py-2.5 text-sm text-[#3B2A1F] focus:outline-none focus:ring-2 focus:ring-[#C8A96A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A6A58] mb-1">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="billing@client.com"
                className="w-full rounded-xl border border-[#C8A96A]/40 bg-white px-3 py-2.5 text-sm text-[#3B2A1F] focus:outline-none focus:ring-2 focus:ring-[#C8A96A]"
              />
            </div>
          </div>

          {/* GSTINs */}
          <div>
            <label className="block text-xs font-medium text-[#7A6A58] mb-2">GSTINs</label>
            {gstins.length > 0 && (
              <div className="space-y-2 mb-3">
                {gstins.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#C8A96A]/30">
                    <span className="flex-1 text-sm font-mono text-[#3B2A1F]">{g.gstin}</span>
                    <span className="text-xs text-[#7A6A58]">{g.state}</span>
                    {g.is_primary && (
                      <span className="text-xs bg-[#C8A96A]/20 text-[#A05C1A] px-2 py-0.5 rounded-full">Primary</span>
                    )}
                    <button
                      onClick={() => removeGstin(i)}
                      className="text-[#8B2E2E] text-xs hover:underline min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >Remove</button>
                  </div>
                ))}
              </div>
            )}
            {/* Add new GSTIN row */}
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  value={newGstin}
                  onChange={e => setNewGstin(e.target.value.toUpperCase())}
                  placeholder="29ABCDE1234F1Z5"
                  maxLength={15}
                  className="w-full rounded-xl border border-[#C8A96A]/40 bg-white px-3 py-2.5 text-sm font-mono text-[#3B2A1F] focus:outline-none focus:ring-2 focus:ring-[#C8A96A]"
                />
              </div>
              <select
                value={newGstinState}
                onChange={e => handleGstinStateChange(e.target.value)}
                className="rounded-xl border border-[#C8A96A]/40 bg-white px-2 py-2.5 text-xs text-[#3B2A1F] focus:outline-none focus:ring-2 focus:ring-[#C8A96A]"
              >
                {AP_STATES.map(s => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={addGstin}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#C8A96A] text-white text-lg font-bold hover:bg-[#A07840] transition-colors"
              >+</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-[#C8A96A]/30">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[#C8A96A]/40 text-[#7A6A58] text-sm font-medium hover:bg-[#C8A96A]/10 transition-colors"
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#3B2A1F] text-[#F5F1E8] text-sm font-medium hover:bg-[#2A1D13] disabled:opacity-50 transition-colors"
          >{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Client'}</button>
        </div>
      </div>
    </div>
  )
}
