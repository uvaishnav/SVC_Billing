import React, { useEffect, useState } from 'react'
import { getBankAccounts, upsertBankAccount, deactivateBankAccount, upsertSettings } from '../../db/settingsDb'
import type { BankAccount, Settings } from '../../db/types'
import { Field, PrimaryButton, inputStyle, labelStyle, cardStyle, sectionTitleStyle } from './_components'

interface Props { settings: Settings | null; onSettingsUpdate: (s: Settings) => void }

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
        : [...prev, saved])
      setEditing(null)
    }
    setSaving(false)
  }

  async function handleDeactivate(id: number) {
    await deactivateBankAccount(id)
    setAccounts(prev => prev.filter(a => a.id !== id))
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
    <div>
      <p style={sectionTitleStyle}>Bank Accounts</p>

      {accounts.length === 0 && !editing && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: '15px' }}>
          No bank accounts added yet
        </div>
      )}

      {accounts.map(acc => (
        <div key={acc.id} style={{ ...cardStyle, marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-primary)' }}>{acc.nickname}</span>
                {settings?.default_bank_account_id === acc.id && (
                  <span style={{ background: 'var(--color-success)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px' }}>DEFAULT</span>
                )}
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', margin: '2px 0' }}>{acc.bank_name} · {acc.ifsc}</p>
              <p style={{ color: 'var(--color-text)', fontSize: '15px', fontVariantNumeric: 'tabular-nums', margin: '2px 0' }}>A/C {acc.account_number}</p>
              {acc.branch && <p style={{ color: 'var(--color-text-faint)', fontSize: '13px', marginTop: '2px' }}>{acc.branch}</p>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              {settings?.default_bank_account_id !== acc.id && (
                <button onClick={() => setDefault(acc.id)} style={{ padding: '6px 12px', background: 'var(--color-surface-offset)', color: 'var(--color-text)', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Set Default</button>
              )}
              <button onClick={() => setEditing(acc)} style={{ padding: '6px 12px', background: 'var(--color-surface-offset)', color: 'var(--color-info)', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Edit</button>
              <button onClick={() => handleDeactivate(acc.id)} style={{ padding: '6px 12px', background: '#FDF0F0', color: 'var(--color-error)', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        </div>
      ))}

      {editing !== null ? (
        <div style={{ ...cardStyle, border: '2px solid var(--color-accent)', marginTop: '8px' }}>
          <p style={{ ...sectionTitleStyle, marginBottom: '16px' }}>{editing.id ? 'Edit Account' : 'New Bank Account'}</p>
          <Field label="Nickname" value={editing.nickname ?? ''} onChange={v => setEditing(p => ({ ...p, nickname: v }))} placeholder="e.g. HDFC Main" required />
          <Field label="Account Name" value={editing.account_name ?? ''} onChange={v => setEditing(p => ({ ...p, account_name: v }))} placeholder="As per bank records" required />
          <Field label="Account Number" value={editing.account_number ?? ''} onChange={v => setEditing(p => ({ ...p, account_number: v }))} placeholder="Account number" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="IFSC Code" value={editing.ifsc ?? ''} onChange={v => setEditing(p => ({ ...p, ifsc: v }))} placeholder="HDFC0008170" required />
            <Field label="Bank Name" value={editing.bank_name ?? ''} onChange={v => setEditing(p => ({ ...p, bank_name: v }))} placeholder="HDFC Bank" required />
          </div>
          <Field label="Branch (optional)" value={editing.branch ?? ''} onChange={v => setEditing(p => ({ ...p, branch: v }))} placeholder="Kankipadu Branch" />
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Account'}</PrimaryButton>
            <button onClick={() => setEditing(null)} style={{ flex: 1, padding: '16px', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing({ ...EMPTY })}
          style={{ width: '100%', padding: '16px', background: 'transparent', border: '2px dashed var(--color-accent)', color: 'var(--color-accent)', fontWeight: 600, fontSize: '15px', borderRadius: '14px', cursor: 'pointer', marginTop: '4px' }}
        >
          + Add Bank Account
        </button>
      )}
    </div>
  )
}
