import React, { useEffect, useState } from 'react'
import { getSacCodes, upsertSacCode, deactivateSacCode, upsertSettings } from '../../db/settingsDb'
import type { SacCode, Settings } from '../../db/types'

interface Props {
  settings: Settings | null
  onSettingsUpdate: (s: Settings) => void
}

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
        : [...prev, saved]
      )
      setEditing(null)
    }
    setSaving(false)
  }

  async function handleDeactivate(id: number) {
    await deactivateSacCode(id)
    setCodes(prev => prev.filter(c => c.id !== id))
    if (settings?.default_sac_id === id) {
      const updated = await upsertSettings({ default_sac_id: null })
      if (updated) onSettingsUpdate(updated)
    }
  }

  async function setDefault(id: number) {
    const updated = await upsertSettings({ default_sac_id: id })
    if (updated) onSettingsUpdate(updated)
  }

  return (
    <div className="space-y-4">
      {codes.map(code => (
        <div key={code.id} className="bg-[#FAF8F3] border border-[#D9D3C5] rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-[#3B2A1F]">{code.nickname}</p>
              <p className="text-sm font-mono text-[#7A6A58]">{code.sac_code}</p>
              {code.description && <p className="text-xs text-[#B8A99A] mt-1">{code.description}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              {settings?.default_sac_id === code.id ? (
                <span className="text-xs bg-[#5A7A2E] text-white px-2 py-1 rounded-full">Default</span>
              ) : (
                <button onClick={() => setDefault(code.id)} className="text-xs text-[#C8A96A] underline">Set default</button>
              )}
              <button onClick={() => setEditing(code)} className="text-xs text-[#2A5F8A] underline">Edit</button>
              <button onClick={() => handleDeactivate(code.id)} className="text-xs text-[#8B2E2E] underline">Remove</button>
            </div>
          </div>
        </div>
      ))}

      {editing !== null ? (
        <div className="bg-white border border-[#C8A96A] rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-[#3B2A1F]">{editing.id ? 'Edit SAC Code' : 'Add SAC Code'}</h3>
          {(['nickname', 'sac_code', 'description'] as const).map(field => (
            <input
              key={field}
              placeholder={field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              value={(editing[field] as string) ?? ''}
              onChange={e => setEditing(prev => ({ ...prev, [field]: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-[#D9D3C5] bg-[#FAF8F3] text-[#2A1F15] focus:outline-none focus:ring-2 focus:ring-[#C8A96A] text-base"
            />
          ))}
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3 bg-[#3B2A1F] text-[#F5F1E8] font-semibold rounded-xl active:opacity-80 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save SAC Code'}
            </button>
            <button onClick={() => setEditing(null)}
              className="px-4 py-3 border border-[#D9D3C5] text-[#7A6A58] rounded-xl">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing({ ...EMPTY })}
          className="w-full py-3 border-2 border-dashed border-[#C8A96A] text-[#C8A96A] font-semibold rounded-xl active:opacity-70">
          + Add SAC Code
        </button>
      )}
    </div>
  )
}
