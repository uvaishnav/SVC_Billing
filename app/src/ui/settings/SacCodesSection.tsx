import { useEffect, useState } from 'react'
import { getSacCodes, upsertSacCode, deactivateSacCode, patchSettings } from '../../db/settingsDb'
import type { SacCode, Settings } from '../../db/types'
import { Field, PrimaryButton, cardStyle, sectionTitleStyle } from './_components'

interface Props { settings: Settings | null; onSettingsUpdate: (s: Settings) => void }

const EMPTY: Omit<SacCode, 'id'> = { nickname: '', sac_code: '', description: '', is_active: true }

export default function SacCodesSection({ settings, onSettingsUpdate }: Props) {
  const [codes, setCodes] = useState<SacCode[]>([])
  const [editing, setEditing] = useState<Partial<SacCode> | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { getSacCodes().then(setCodes) }, [])

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    const saved = await upsertSacCode(editing)
    if (saved) {
      setCodes(prev => prev.some(c => c.id === saved.id)
        ? prev.map(c => c.id === saved.id ? saved : c)
        : [...prev, saved])
      setEditing(null)
    }
    setSaving(false)
  }

  async function handleDeactivate(id: number) {
    await deactivateSacCode(id)
    setCodes(prev => prev.filter(c => c.id !== id))
    if (settings?.default_sac_id === id) {
      const updated = await patchSettings({ default_sac_id: null })
      if (updated) onSettingsUpdate(updated)
    }
  }

  async function setDefault(id: number) {
    const updated = await patchSettings({ default_sac_id: id })
    if (updated) onSettingsUpdate(updated)
  }

  return (
    <div>
      <p style={sectionTitleStyle}>SAC Codes</p>

      {codes.length === 0 && !editing && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: '15px' }}>
          No SAC codes found. The seed data may not have run yet.
        </div>
      )}

      {codes.map(code => (
        <div key={code.id} style={{ ...cardStyle, marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-primary)' }}>{code.nickname}</span>
                {settings?.default_sac_id === code.id && (
                  <span style={{ background: 'var(--color-success)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px' }}>DEFAULT</span>
                )}
              </div>
              <p style={{ fontFamily: 'monospace', fontSize: '15px', color: 'var(--color-accent)', fontWeight: 600, margin: '2px 0' }}>{code.sac_code}</p>
              {code.description && <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '4px' }}>{code.description}</p>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              {settings?.default_sac_id !== code.id && (
                <button onClick={() => setDefault(code.id)} style={{ padding: '6px 12px', background: 'var(--color-surface-offset)', color: 'var(--color-text)', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Set Default</button>
              )}
              <button onClick={() => setEditing(code)} style={{ padding: '6px 12px', background: 'var(--color-surface-offset)', color: 'var(--color-info)', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Edit</button>
              <button onClick={() => handleDeactivate(code.id)} style={{ padding: '6px 12px', background: '#FDF0F0', color: 'var(--color-error)', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      ))}

      {editing !== null ? (
        <div style={{ ...cardStyle, border: '2px solid var(--color-accent)', marginTop: '8px' }}>
          <p style={{ ...sectionTitleStyle, marginBottom: '16px' }}>{editing.id ? 'Edit SAC Code' : 'New SAC Code'}</p>
          <Field label="Nickname" value={editing.nickname ?? ''} onChange={v => setEditing(p => ({ ...p, nickname: v }))} placeholder="e.g. Equipment Rental" required />
          <Field label="SAC Code" value={editing.sac_code ?? ''} onChange={v => setEditing(p => ({ ...p, sac_code: v }))} placeholder="997319" required />
          <Field label="Description (optional)" value={editing.description ?? ''} onChange={v => setEditing(p => ({ ...p, description: v }))} placeholder="Brief GST description" />
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save SAC Code'}</PrimaryButton>
            <button onClick={() => setEditing(null)} style={{ flex: 1, padding: '16px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing({ ...EMPTY })}
          style={{ width: '100%', padding: '16px', background: 'transparent', border: '2px dashed var(--color-accent)', color: 'var(--color-accent)', fontWeight: 600, fontSize: '15px', borderRadius: '14px', cursor: 'pointer', marginTop: '4px' }}
        >
          + Add SAC Code
        </button>
      )}
    </div>
  )
}
