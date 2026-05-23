import React, { useState } from 'react'
import type { ClientWithGstins, ClientGstin } from '../../db/types'
import { upsertClient, upsertClientGstin, deleteClientGstin } from '../../db/clientsDb'
import { Field, PrimaryButton, cardStyle, sectionTitleStyle, inputStyle, labelStyle } from '../settings/_components'

const STATES = [
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

  const [name, setName]       = useState(client?.name ?? '')
  const [address, setAddress] = useState(client?.address ?? '')
  const [state, setState]     = useState(client?.state ?? 'Andhra Pradesh')
  const [stateCode, setStateCode] = useState(client?.state_code ?? '37')
  const [phone, setPhone]     = useState(client?.phone ?? '')
  const [email, setEmail]     = useState(client?.email ?? '')
  const [gstins, setGstins]   = useState<Partial<ClientGstin>[]>(client?.gstins ?? [])
  const [newGstin, setNewGstin]           = useState('')
  const [newGstinState, setNewGstinState] = useState('Andhra Pradesh')
  const [newGstinCode, setNewGstinCode]   = useState('37')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function handleStateChange(stateName: string) {
    setState(stateName)
    setStateCode(STATES.find(s => s.name === stateName)?.code ?? '99')
  }

  function handleGstinStateChange(stateName: string) {
    setNewGstinState(stateName)
    setNewGstinCode(STATES.find(s => s.name === stateName)?.code ?? '99')
  }

  function addGstin() {
    const val = newGstin.trim().toUpperCase()
    if (!val) return
    setGstins(prev => [...prev, {
      gstin: val,
      state: newGstinState,
      state_code: newGstinCode,
      is_primary: prev.length === 0,
    }])
    setNewGstin('')
  }

  async function removeGstin(index: number) {
    const g = gstins[index]
    if (g.id) await deleteClientGstin(g.id)
    setGstins(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!name.trim())    { setError('Client name is required'); return }
    if (!address.trim()) { setError('Address is required'); return }
    setSaving(true); setError(null)

    const saved = await upsertClient({
      id: client?.id,
      name: name.trim(),
      address: address.trim(),
      state, state_code: stateCode,
      phone: phone.trim() || null,
      email: email.trim() || null,
      is_active: true,
    })
    if (!saved) { setError('Failed to save. Please try again.'); setSaving(false); return }

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

  return (
    // Overlay
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(30,20,10,0.55)',
      display: 'flex', alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 200,
      padding: '0',
    }}>
      {/* Sheet */}
      <div style={{
        background: 'var(--color-bg)',
        borderRadius: '20px 20px 0 0',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '92svh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Handle + Header */}
        <div style={{
          background: 'var(--color-primary)',
          padding: '12px 20px 16px',
          borderRadius: '20px 20px 0 0',
          flexShrink: 0,
        }}>
          {/* Drag handle */}
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: 'var(--color-bg)', fontSize: '20px', fontFamily: 'Playfair Display, serif' }}>
              {isEdit ? 'Edit Client' : 'New Client'}
            </h2>
            <button
              onClick={onClose}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                color: 'var(--color-bg)',
                fontSize: '18px', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 20px' }}>

          {error && (
            <div style={{
              background: 'rgba(139,46,46,0.08)',
              border: '1px solid var(--color-error)',
              color: 'var(--color-error)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              marginBottom: '16px',
            }}>{error}</div>
          )}

          <Field label="Client Name" value={name} onChange={setName} placeholder="e.g. RSV Constructions Pvt Ltd" required />
          <Field label="Address" value={address} onChange={setAddress} placeholder="Street, City, PIN" required rows={2} />

          {/* State */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Primary State</label>
            <select
              value={state}
              onChange={e => handleStateChange(e.target.value)}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              {STATES.map(s => (
                <option key={s.code} value={s.name}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          {/* Phone + Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="billing@client.com" type="email" />
          </div>

          {/* GSTINs */}
          <div style={{ marginBottom: '16px' }}>
            <p style={sectionTitleStyle}>GSTINs</p>

            {gstins.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {gstins.map((g, i) => (
                  <div key={i} style={{
                    ...cardStyle,
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)', marginBottom: '2px' }}>{g.gstin}</p>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{g.state}</p>
                    </div>
                    {g.is_primary && (
                      <span style={{
                        fontSize: '11px', fontWeight: 600,
                        color: '#fff',
                        background: 'var(--color-success)',
                        padding: '2px 8px', borderRadius: '20px',
                      }}>PRIMARY</span>
                    )}
                    <button
                      onClick={() => removeGstin(i)}
                      style={{ padding: '4px 10px', background: '#FDF0F0', color: 'var(--color-error)', fontSize: '13px', fontWeight: 500, borderRadius: '6px', border: 'none', cursor: 'pointer', minHeight: '32px' }}
                    >Remove</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add GSTIN row */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>GSTIN</label>
                <input
                  value={newGstin}
                  onChange={e => setNewGstin(e.target.value.toUpperCase())}
                  placeholder="29ABCDE1234F1Z5"
                  maxLength={15}
                  style={{ ...inputStyle }}
                />
              </div>
              <div style={{ flexShrink: 0, minWidth: '130px' }}>
                <label style={labelStyle}>State</label>
                <select
                  value={newGstinState}
                  onChange={e => handleGstinStateChange(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' }}
                >
                  {STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <button
                onClick={addGstin}
                style={{
                  height: '50px', minWidth: '50px',
                  background: 'var(--color-accent)',
                  color: 'var(--color-primary)',
                  fontSize: '22px', fontWeight: 700,
                  borderRadius: '12px', border: 'none', cursor: 'pointer',
                  flexShrink: 0, alignSelf: 'flex-end',
                }}
              >+</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
          display: 'flex', gap: '12px',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '16px',
              background: 'var(--color-surface-offset)',
              color: 'var(--color-text-muted)',
              fontWeight: 600, fontSize: '16px',
              borderRadius: '12px', border: 'none', cursor: 'pointer',
              fontFamily: 'Work Sans, sans-serif',
            }}
          >Cancel</button>
          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Client'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
