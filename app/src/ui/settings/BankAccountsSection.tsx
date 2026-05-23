import React, { useEffect, useState } from 'react'
import { getBankAccounts, upsertBankAccount, deactivateBankAccount, upsertSettings } from '../../db/settingsDb'
import type { BankAccount, Settings } from '../../db/types'

interface Props {
  settings: Settings | null
  onSettingsUpdate: (s: Settings) => void
}

const EMPTY: Omit<BankAccount, 'id' | 'created_at'> = {
  nickname: '', account_name: '', account_number: '', ifsc: '', bank_name: '', branch: '', is_active: true
}

export default function BankAccountsSection({ settings, onSettingsUpdate }: Props) {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [editing, setEditing] = useState<Partial<BankAccount> | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { getBankAccounts().then(setAccounts) }, [])

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    const saved = await upsertBankAccount(editing)
    if (saved) {
      setAccounts(prev => prev.some(a => a.id === saved.id)
        ? prev.map(a => a.id === saved.id ? saved : a)
        : [...prev, saved]
      )
      setEditing(null)
    }
    setSaving(false)
  }

  async function handleDeactivate(id: number) {
    await deactivateBankAccount(id)
    setAccounts(prev => prev.filter(a => a.id !== id))
    // Clear default if deactivated
    if (settings?.default_bank_account_id === id) {
      const updated = await upsertSettings({ default_bank_account_id: null })
      if (updated) onSettingsUpdate(updated)
    }
  }

  async function setDefault(id: number) {
    const updated = await upsertSettings({ default_bank_account_id: id })
    if (updated) onSettingsUpdate(updated)
  }

  return (
    <div className="space-y-4">
      {/* Account list */}
      {accounts.map(acc => (
        <div key={acc.id} className="bg-[#FAF8F3] border border-[#D9D3C5] rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-[#3B2A1F]">{acc.nickname}</p>
              <p className="text-sm text-[#7A6A58]">{acc.bank_name} — {acc.ifsc}</p>
              <p className="text-sm text-[#7A6A58]">A/C: {acc.account_number}</p>
              {acc.branch && <p className="text-xs text-[#B8A99A]">{acc.branch}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              {settings?.default_bank_account_id === acc.id ? (
                <span className="text-xs bg-[#5A7A2E] text-white px-2 py-1 rounded-full">Default</span>
              ) : (
                <button onClick={() => setDefault(acc.id)} className="text-xs text-[#C8A96A] underline">Set default</button>
              )}
              <button onClick={() => setEditing(acc)} className="text-xs text-[#2A5F8A] underline">Edit</button>
              <button onClick={() => handleDeactivate(acc.id)} className="text-xs text-[#8B2E2E] underline">Remove</button>
            </div>
          </div>
        </div>
      ))}

      {/* Add / Edit form */}
      {editing !== null ? (
        <div className="bg-white border border-[#C8A96A] rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-[#3B2A1F]">{editing.id ? 'Edit Account' : 'Add Bank Account'}</h3>
          {(['nickname', 'account_name', 'account_number', 'ifsc', 'bank_name', 'branch'] as const).map(field => (
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
              {saving ? 'Saving…' : 'Save Account'}
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
          + Add Bank Account
        </button>
      )}
    </div>
  )
}
