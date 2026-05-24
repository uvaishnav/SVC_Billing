import React, { useState, useEffect } from 'react'
import type { ProjectWithClient, Client } from '../../db/types'
import { upsertProject } from '../../db/projectsDb'
import { supabase } from '../../db/supabaseClient'
import { Field, PrimaryButton, sectionTitleStyle } from '../settings/_components'

const AP_STATES = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Telangana',      code: '36' },
  { name: 'Karnataka',      code: '29' },
  { name: 'Tamil Nadu',     code: '33' },
  { name: 'Maharashtra',    code: '27' },
  { name: 'Odisha',         code: '21' },
  { name: 'Other',          code: '' },
]

interface Props {
  project?: ProjectWithClient | null
  onClose: () => void
  onSaved: () => void
}

export default function ProjectFormModal({ project, onClose, onSaved }: Props) {
  const isEdit = !!project

  const [clients,       setClients]       = useState<Client[]>([])
  const [name,          setName]          = useState(project?.name ?? '')
  const [fullSubject,   setFullSubject]   = useState(project?.full_subject ?? '')
  const [siteLocation,  setSiteLocation]  = useState(project?.site_location ?? '')
  const [clientId,      setClientId]      = useState<string>(project?.client_id?.toString() ?? '')
  const [placeOfSupply, setPlaceOfSupply] = useState(project?.place_of_supply ?? 'Andhra Pradesh')
  const [stateCode,     setStateCode]     = useState(project?.state_code ?? '37')
  const [notes,         setNotes]         = useState(project?.notes ?? '')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  useEffect(() => {
    supabase.from('clients').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setClients(data ?? []))
  }, [])

  function handleStateChange(stateName: string) {
    setPlaceOfSupply(stateName)
    const found = AP_STATES.find(s => s.name === stateName)
    setStateCode(found?.code ?? '')
  }

  async function handleSave() {
    if (!name.trim()) { setError('Project name is required'); return }
    if (!placeOfSupply.trim()) { setError('Place of supply is required'); return }
    setSaving(true); setError(null)

    const saved = await upsertProject({
      id:             project?.id,
      name:           name.trim(),
      full_subject:   fullSubject.trim() || null,
      site_location:  siteLocation.trim() || null,
      client_id:      clientId ? parseInt(clientId) : null,
      place_of_supply: placeOfSupply.trim(),
      state_code:     stateCode.trim(),
      notes:          notes.trim() || null,
      is_active:      true,
    })

    if (!saved) { setError('Failed to save project. Please try again.'); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: '15px', fontFamily: 'Work Sans, sans-serif',
    boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,20,10,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--color-bg)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '640px', maxHeight: '92svh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'var(--color-primary)', padding: '12px 20px 16px', borderRadius: '20px 20px 0 0', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: 'var(--color-bg)', fontSize: '20px', fontFamily: 'Playfair Display, serif' }}>
              {isEdit ? 'Edit Project' : 'New Project'}
            </h2>
            <button type="button" onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'var(--color-bg)', fontSize: '18px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 20px' }}>
          {error && (
            <div style={{ background: 'rgba(139,46,46,0.08)', border: '1px solid var(--color-error)', color: 'var(--color-error)', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>
          )}

          <p style={sectionTitleStyle}>Project Identity</p>
          <Field label="Project Name *" value={name} onChange={setName} placeholder="e.g. RSV LC-14 ROB" required />
          <Field label="Site Location" value={siteLocation} onChange={setSiteLocation} placeholder="e.g. Vijayawada–Gudivada Section" />

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'Work Sans, sans-serif', display: 'block', marginBottom: '6px' }}>Client (optional)</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
              <option value="">— No client linked —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <p style={{ ...sectionTitleStyle, marginTop: '8px' }}>GST Location</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-faint)', marginBottom: '14px', lineHeight: 1.5 }}>
            State where the work is physically performed. Determines intrastate vs interstate GST on invoices.
          </p>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'Work Sans, sans-serif', display: 'block', marginBottom: '6px' }}>Place of Supply (State) *</label>
            <select value={placeOfSupply} onChange={e => handleStateChange(e.target.value)} style={inputStyle}>
              {AP_STATES.map(s => <option key={s.name} value={s.name}>{s.name} {s.code ? `(${s.code})` : ''}</option>)}
            </select>
          </div>
          {stateCode && (
            <div style={{ background: 'var(--color-info-highlight)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: 'var(--color-info)' }}>
              State Code: <strong>{stateCode}</strong> — invoices for this project will be <strong>{stateCode === '37' ? 'Intrastate (CGST + SGST)' : 'Interstate (IGST)'}</strong>
            </div>
          )}

          <p style={{ ...sectionTitleStyle, marginTop: '8px' }}>Reference Text (optional)</p>
          <div style={{ marginBottom: '16px' }}>
            <textarea
              value={fullSubject}
              onChange={e => setFullSubject(e.target.value)}
              placeholder="Full subject line from work order…"
              rows={3}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />
          </div>

          <p style={sectionTitleStyle}>Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional notes…"
            rows={3}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0, display: 'flex', gap: '12px' }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '16px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}>Cancel</button>
          <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Project'}</PrimaryButton>
        </div>
      </div>
    </div>
  )
}
