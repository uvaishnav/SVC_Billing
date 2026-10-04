import { useState, useEffect } from 'react'
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

  const [clients,       setClients]       = useState<{ id: number; name: string }[]>([])
  const [workOrders,    setWorkOrders]    = useState<{ id: number; wo_reference: string | null; subject: string }[]>([])
  const [name,          setName]          = useState(project?.name ?? '')
  const [fullSubject,   setFullSubject]   = useState(project?.full_subject ?? '')
  const [siteLocation,  setSiteLocation]  = useState(project?.site_location ?? '')
  const [clientId,      setClientId]      = useState<string>(project?.client_id?.toString() ?? '')
  const [workOrderId,   setWorkOrderId]   = useState<string>(project?.work_order_id?.toString() ?? '')
  const [placeOfSupply, setPlaceOfSupply] = useState(project?.place_of_supply ?? 'Andhra Pradesh')
  const [stateCode,     setStateCode]     = useState(project?.state_code ?? '37')
  const [notes,         setNotes]         = useState(project?.notes ?? '')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  useEffect(() => {
    supabase.from('clients').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setClients(data ?? []))
  }, [])

  useEffect(() => {
    if (!clientId) {
      setWorkOrders([])
      setWorkOrderId('')
      return
    }
    supabase.from('work_orders')
      .select('id, wo_reference, subject')
      .eq('client_id', parseInt(clientId))
      .order('issue_date', { ascending: false })
      .then(({ data }) => {
        setWorkOrders(data ?? [])
      })
  }, [clientId])

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
      work_order_id:  workOrderId ? parseInt(workOrderId) : null,
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <h2 style={{ color: 'var(--color-bg)', fontSize: '20px', fontFamily: 'Playfair Display, serif', margin: 0 }}>
              {isEdit ? 'Edit Project' : 'New Project'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-accent)',
                  color: 'var(--color-primary)',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  fontFamily: 'Work Sans, sans-serif',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'var(--color-bg)', fontSize: '18px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'Work Sans, sans-serif', display: 'block', marginBottom: '6px' }}>Parent Work Order (optional)</label>
            <select
              value={workOrderId}
              onChange={e => {
                const wid = e.target.value
                setWorkOrderId(wid)
                if (wid && !fullSubject) {
                  const selectedWo = workOrders.find(w => w.id === parseInt(wid))
                  if (selectedWo) setFullSubject(selectedWo.subject)
                }
              }}
              disabled={!clientId}
              style={{ ...inputStyle, opacity: !clientId ? 0.6 : 1 }}
            >
              <option value="">— No work order linked —</option>
              {workOrders.map(wo => (
                <option key={wo.id} value={wo.id}>
                  {wo.wo_reference ? `${wo.wo_reference} — ` : ''}{wo.subject.slice(0, 45)}
                </option>
              ))}
            </select>
            {!clientId && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginTop: '4px' }}>
                Select a client first to link this project to their work order.
              </p>
            )}
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
        <div style={{
          padding: '16px 20px calc(16px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          boxSizing: 'border-box',
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              minHeight: '48px',
              padding: '14px 16px',
              background: 'var(--color-surface-offset)',
              color: 'var(--color-text-muted)',
              fontWeight: 600,
              fontSize: '15px',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              fontFamily: 'Work Sans, sans-serif',
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Cancel
          </button>
          <PrimaryButton
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2,
              minHeight: '48px',
              boxSizing: 'border-box',
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Project'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
