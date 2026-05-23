import React, { useState } from 'react'
import type { ClientWithGstins, ClientGstin } from '../../db/types'
import { upsertClient, upsertClientGstin, deleteClientGstin } from '../../db/clientsDb'
import { Field, PrimaryButton, cardStyle, sectionTitleStyle, inputStyle, labelStyle } from '../settings/_components'

const STATES = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Telangana',      code: '36' },
  { name: 'Tamil Nadu',     code: '33' },
  { name: 'Karnataka',      code: '29' },
  { name: 'Maharashtra',    code: '27' },
  { name: 'Delhi',          code: '07' },
  { name: 'Uttar Pradesh',  code: '09' },
  { name: 'West Bengal',    code: '19' },
  { name: 'Gujarat',        code: '24' },
  { name: 'Rajasthan',      code: '08' },
  { name: 'Other',          code: '99' },
]

// A GSTIN entry being composed in the form (before saving)
interface GstinDraft {
  id?: number        // present only when editing an existing row
  gstin: string
  state: string
  state_code: string
  address: string
  is_primary: boolean
}

const EMPTY_GSTIN_DRAFT: GstinDraft = {
  gstin: '', state: 'Andhra Pradesh', state_code: '37', address: '', is_primary: false,
}

interface Props {
  client?: ClientWithGstins | null
  onClose: () => void
  onSaved: () => void
}

export default function ClientFormModal({ client, onClose, onSaved }: Props) {
  const isEdit = !!client

  // ── Client-level fields ───────────────────────────────────
  const [name,  setName]  = useState(client?.name  ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [email, setEmail] = useState(client?.email ?? '')

  // ── Saved GSTINs (already in DB or added this session) ────
  const [gstins, setGstins] = useState<GstinDraft[]>(
    client?.gstins.map(g => ({
      id:         g.id,
      gstin:      g.gstin,
      state:      g.state,
      state_code: g.state_code,
      address:    g.address,
      is_primary: g.is_primary,
    })) ?? []
  )

  // ── New GSTIN being composed ──────────────────────────────
  const [draft, setDraft] = useState<GstinDraft>({ ...EMPTY_GSTIN_DRAFT })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // ── Draft helpers ─────────────────────────────────────────
  function setDraftState(stateName: string) {
    const code = STATES.find(s => s.name === stateName)?.code ?? '99'
    setDraft(d => ({ ...d, state: stateName, state_code: code }))
  }

  function commitDraft() {
    const gstin = draft.gstin.trim().toUpperCase()
    if (!gstin)          { setError('Enter a GSTIN before clicking +'); return }
    if (!draft.address.trim()) { setError('Enter the registered address for this GSTIN'); return }
    if (gstins.some(g => g.gstin === gstin)) { setError('This GSTIN is already added'); return }
    setError(null)
    const isPrimary = gstins.length === 0   // first one is always primary
    setGstins(prev => [...prev, { ...draft, gstin, is_primary: isPrimary }])
    setDraft({ ...EMPTY_GSTIN_DRAFT })       // reset draft
  }

  async function removeGstin(index: number) {
    const g = gstins[index]
    if (g.id) await deleteClientGstin(g.id)  // delete from DB if already saved
    setGstins(prev => prev.filter((_, i) => i !== index))
  }

  // ── Save ──────────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) { setError('Client name is required'); return }
    setSaving(true); setError(null)

    // 1. Save / update the client row
    const saved = await upsertClient({
      id:       client?.id,
      name:     name.trim(),
      phone:    phone.trim() || null,
      email:    email.trim() || null,
      is_active: true,
    })
    if (!saved) { setError('Failed to save client. Please try again.'); setSaving(false); return }

    // 2. Save any GSTINs that don't have a DB id yet (newly added this session)
    for (const g of gstins) {
      if (!g.id) {
        await upsertClientGstin({
          client_id:  saved.id,
          gstin:      g.gstin,
          state:      g.state,
          state_code: g.state_code,
          address:    g.address,
          is_primary: g.is_primary,
        })
      }
    }

    setSaving(false)
    onSaved()
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(30,20,10,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{
        background: 'var(--color-bg)',
        borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: '640px',
        maxHeight: '92svh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          background: 'var(--color-primary)',
          padding: '12px 20px 16px',
          borderRadius: '20px 20px 0 0',
          flexShrink: 0,
        }}>
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: 'var(--color-bg)', fontSize: '20px', fontFamily: 'Playfair Display, serif' }}>
              {isEdit ? 'Edit Client' : 'New Client'}
            </h2>
            <button onClick={onClose} style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', color: 'var(--color-bg)',
              fontSize: '18px', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 20px' }}>

          {error && (
            <div style={{
              background: 'rgba(139,46,46,0.08)', border: '1px solid var(--color-error)',
              color: 'var(--color-error)', borderRadius: '10px',
              padding: '10px 14px', fontSize: '14px', marginBottom: '16px',
            }}>{error}</div>
          )}

          {/* ── Section 1: Identity ── */}
          <p style={sectionTitleStyle}>Client Details</p>
          <Field label="Client Name" value={name} onChange={setName} placeholder="e.g. RSV Constructions Pvt Ltd" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="billing@client.com" type="email" />
          </div>

          {/* ── Section 2: GSTINs ── */}
          <p style={{ ...sectionTitleStyle, marginTop: '8px' }}>GST Registrations</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-faint)', marginBottom: '14px', lineHeight: 1.5 }}>
            Add one entry per state where the client is GST-registered. Each registration has its own address.
          </p>

          {/* Already-added GSTINs */}
          {gstins.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {gstins.map((g, i) => (
                <div key={i} style={{ ...cardStyle, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <p style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-primary)' }}>{g.gstin}</p>
                        {g.is_primary && (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff', background: 'var(--color-success)', padding: '2px 8px', borderRadius: '20px' }}>PRIMARY</span>
                        )}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{g.state} · {g.address}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGstin(i)}
                      style={{ padding: '4px 10px', background: '#FDF0F0', color: 'var(--color-error)', fontSize: '13px', fontWeight: 500, borderRadius: '6px', border: 'none', cursor: 'pointer', flexShrink: 0, minHeight: '32px' }}
                    >Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Draft: compose a new GSTIN entry */}
          <div style={{ ...cardStyle, border: '2px dashed var(--color-accent)', padding: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add GST Registration</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>GSTIN *</label>
                <input
                  value={draft.gstin}
                  onChange={e => setDraft(d => ({ ...d, gstin: e.target.value.toUpperCase() }))}
                  placeholder="37ABCDE1234F1Z5"
                  maxLength={15}
                  style={{ ...inputStyle }}
                />
              </div>
              <div>
                <label style={labelStyle}>State *</label>
                <select
                  value={draft.state}
                  onChange={e => setDraftState(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' as any }}
                >
                  {STATES.map(s => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Registered Address *</label>
              <textarea
                value={draft.address}
                onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                placeholder="GST-registered office address for this state"
                rows={2}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
              />
            </div>

            <button
              type="button"
              onClick={commitDraft}
              style={{
                width: '100%', marginTop: '12px',
                padding: '12px',
                background: 'var(--color-accent)',
                color: 'var(--color-primary)',
                fontWeight: 600, fontSize: '15px',
                borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontFamily: 'Work Sans, sans-serif',
              }}
            >+ Add This Registration</button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0, display: 'flex', gap: '12px',
        }}>
          <button
            type="button"
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
