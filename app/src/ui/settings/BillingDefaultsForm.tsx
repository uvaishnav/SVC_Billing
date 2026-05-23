import React, { useEffect, useState } from 'react'
import { getBankAccounts, getSacCodes, upsertSettings } from '../../db/settingsDb'
import type { Settings, BankAccount, SacCode } from '../../db/types'

interface Props {
  settings: Settings | null
  onSaved: (s: Settings) => void
}

export default function BillingDefaultsForm({ settings, onSaved }: Props) {
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [sacs, setSacs] = useState<SacCode[]>([])
  const [form, setForm] = useState({
    default_tds_rate: '2.00',
    tds_applicable: true,
    reverse_charge_applicable: false,
    default_billing_period: 'monthly',
    default_bank_account_id: '' as string | number,
    default_sac_id: '' as string | number,
    invoice_prefix: 'SVC',
    sequence_padding: '3',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getBankAccounts().then(setBanks)
    getSacCodes().then(setSacs)
  }, [])

  useEffect(() => {
    if (settings) {
      setForm({
        default_tds_rate: String(settings.default_tds_rate ?? '2.00'),
        tds_applicable: settings.tds_applicable ?? true,
        reverse_charge_applicable: settings.reverse_charge_applicable ?? false,
        default_billing_period: settings.default_billing_period ?? 'monthly',
        default_bank_account_id: settings.default_bank_account_id ?? '',
        default_sac_id: settings.default_sac_id ?? '',
        invoice_prefix: settings.invoice_prefix ?? 'SVC',
        sequence_padding: String(settings.sequence_padding ?? '3'),
      })
    }
  }, [settings])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const updated = await upsertSettings({
      default_tds_rate: parseFloat(form.default_tds_rate),
      tds_applicable: form.tds_applicable,
      reverse_charge_applicable: form.reverse_charge_applicable,
      default_billing_period: form.default_billing_period,
      default_bank_account_id: form.default_bank_account_id ? Number(form.default_bank_account_id) : null,
      default_sac_id: form.default_sac_id ? Number(form.default_sac_id) : null,
      invoice_prefix: form.invoice_prefix,
      sequence_padding: parseInt(form.sequence_padding),
    })
    if (updated) { onSaved(updated); setSaved(true) }
    setSaving(false)
  }

  const selectClass = "w-full px-4 py-3 rounded-xl border border-[#D9D3C5] bg-[#FAF8F3] text-[#2A1F15] focus:outline-none focus:ring-2 focus:ring-[#C8A96A] text-base"
  const inputClass = selectClass

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Invoice Numbering */}
      <div>
        <h3 className="font-semibold text-[#3B2A1F] mb-3">Invoice Numbering</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-[#3B2A1F] mb-1">Prefix</label>
            <input value={form.invoice_prefix} onChange={e => setForm(p => ({ ...p, invoice_prefix: e.target.value }))}
              className={inputClass} placeholder="SVC" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3B2A1F] mb-1">Seq. Digits</label>
            <input type="number" min={1} max={6} value={form.sequence_padding}
              onChange={e => setForm(p => ({ ...p, sequence_padding: e.target.value }))}
              className={inputClass} />
          </div>
        </div>
      </div>

      {/* TDS */}
      <div>
        <h3 className="font-semibold text-[#3B2A1F] mb-3">TDS</h3>
        <div className="flex items-center gap-3 mb-3">
          <input type="checkbox" id="tds_applicable" checked={form.tds_applicable}
            onChange={e => setForm(p => ({ ...p, tds_applicable: e.target.checked }))}
            className="w-5 h-5 accent-[#3B2A1F]" />
          <label htmlFor="tds_applicable" className="text-sm font-medium text-[#3B2A1F]">TDS Applicable by default</label>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3B2A1F] mb-1">Default TDS Rate (%)</label>
          <input type="number" step="0.01" min={0} max={100} value={form.default_tds_rate}
            onChange={e => setForm(p => ({ ...p, default_tds_rate: e.target.value }))}
            className={inputClass} placeholder="2.00" />
        </div>
      </div>

      {/* GST */}
      <div>
        <h3 className="font-semibold text-[#3B2A1F] mb-3">GST</h3>
        <div className="flex items-center gap-3 mb-3">
          <input type="checkbox" id="reverse_charge" checked={form.reverse_charge_applicable}
            onChange={e => setForm(p => ({ ...p, reverse_charge_applicable: e.target.checked }))}
            className="w-5 h-5 accent-[#3B2A1F]" />
          <label htmlFor="reverse_charge" className="text-sm font-medium text-[#3B2A1F]">Reverse Charge Applicable by default</label>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3B2A1F] mb-1">Default SAC Code</label>
          <select value={form.default_sac_id} onChange={e => setForm(p => ({ ...p, default_sac_id: e.target.value }))}
            className={selectClass}>
            <option value="">— Select SAC Code —</option>
            {sacs.map(s => <option key={s.id} value={s.id}>{s.nickname} ({s.sac_code})</option>)}
          </select>
        </div>
      </div>

      {/* Billing */}
      <div>
        <h3 className="font-semibold text-[#3B2A1F] mb-3">Billing</h3>
        <div className="mb-3">
          <label className="block text-sm font-medium text-[#3B2A1F] mb-1">Default Billing Period</label>
          <select value={form.default_billing_period} onChange={e => setForm(p => ({ ...p, default_billing_period: e.target.value }))}
            className={selectClass}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#3B2A1F] mb-1">Default Bank Account</label>
          <select value={form.default_bank_account_id} onChange={e => setForm(p => ({ ...p, default_bank_account_id: e.target.value }))}
            className={selectClass}>
            <option value="">— Select Bank Account —</option>
            {banks.map(b => <option key={b.id} value={b.id}>{b.nickname}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex-1 py-3 bg-[#3B2A1F] text-[#F5F1E8] font-semibold rounded-xl text-base active:opacity-80 disabled:opacity-50 transition-opacity">
          {saving ? 'Saving…' : 'Save Defaults'}
        </button>
        {saved && <span className="text-[#5A7A2E] text-sm font-medium">✓ Saved</span>}
      </div>
    </form>
  )
}
