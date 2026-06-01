import { useEffect, useState } from 'react'
import { getBankAccounts, getSacCodes, upsertSettings } from '../../db/settingsDb'
import type { Settings, BankAccount, SacCode } from '../../db/types'
import { Field, PrimaryButton, SavedBadge, sectionTitleStyle, labelStyle, inputStyle } from './_components'

interface Props { settings: Settings | null; onSaved: (s: Settings) => void }

export default function BillingDefaultsForm({ settings, onSaved }: Props) {
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [sacs, setSacs] = useState<SacCode[]>([])
  const [form, setForm] = useState({
    default_tds_rate: '2.00', tds_applicable: true,
    reverse_charge_applicable: false, default_billing_period: 'monthly',
    default_bank_account_id: '' as string | number,
    default_sac_id: '' as string | number,
    invoice_prefix: 'SVC', sequence_padding: '3',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getBankAccounts().then(setBanks)
    getSacCodes().then(setSacs)
  }, [])

  useEffect(() => {
    if (settings) setForm({
      default_tds_rate: String(settings.default_tds_rate ?? '2.00'),
      tds_applicable: settings.tds_applicable ?? true,
      reverse_charge_applicable: settings.reverse_charge_applicable ?? false,
      default_billing_period: settings.default_billing_period ?? 'monthly',
      default_bank_account_id: settings.default_bank_account_id ?? '',
      default_sac_id: settings.default_sac_id ?? '',
      invoice_prefix: settings.invoice_prefix ?? 'SVC',
      sequence_padding: String(settings.sequence_padding ?? '3'),
    })
  }, [settings])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
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

  const selectStyle = { ...inputStyle }

  const Toggle = ({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--color-surface-2)', borderRadius: '12px', border: '1.5px solid var(--color-border)', marginBottom: '12px' }}>
      <label htmlFor={id} style={{ fontSize: '15px', color: 'var(--color-text)', fontWeight: 500, cursor: 'pointer' }}>{label}</label>
      <input type="checkbox" id={id} checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: '20px', height: '20px', accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
    </div>
  )

  return (
    <form onSubmit={handleSubmit}>

      {/* Invoice Numbering */}
      <p style={sectionTitleStyle}>Invoice Numbering</p>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <Field label="Invoice Prefix" value={form.invoice_prefix} onChange={v => setForm(p => ({ ...p, invoice_prefix: v }))} placeholder="SVC" />
        <Field label="Seq. Digits" value={form.sequence_padding} onChange={v => setForm(p => ({ ...p, sequence_padding: v }))} placeholder="3" type="number" />
      </div>

      {/* TDS */}
      <p style={{ ...sectionTitleStyle, marginTop: '24px' }}>TDS Settings</p>
      <Toggle id="tds_applicable" checked={form.tds_applicable} onChange={v => setForm(p => ({ ...p, tds_applicable: v }))} label="TDS Applicable by default" />
      <Field label="Default TDS Rate (%)" value={form.default_tds_rate} onChange={v => setForm(p => ({ ...p, default_tds_rate: v }))} placeholder="2.00" type="number" />

      {/* GST */}
      <p style={{ ...sectionTitleStyle, marginTop: '24px' }}>GST Settings</p>
      <Toggle id="reverse_charge" checked={form.reverse_charge_applicable} onChange={v => setForm(p => ({ ...p, reverse_charge_applicable: v }))} label="Reverse Charge Applicable by default" />
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Default SAC Code</label>
        <select value={form.default_sac_id} onChange={e => setForm(p => ({ ...p, default_sac_id: e.target.value }))} style={selectStyle}>
          <option value="">— Select SAC Code —</option>
          {sacs.map(s => <option key={s.id} value={s.id}>{s.nickname} ({s.sac_code})</option>)}
        </select>
      </div>

      {/* Billing */}
      <p style={{ ...sectionTitleStyle, marginTop: '24px' }}>Billing</p>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Default Billing Period</label>
        <select value={form.default_billing_period} onChange={e => setForm(p => ({ ...p, default_billing_period: e.target.value }))} style={selectStyle}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Default Bank Account</label>
        <select value={form.default_bank_account_id} onChange={e => setForm(p => ({ ...p, default_bank_account_id: e.target.value }))} style={selectStyle}>
          <option value="">— Select Bank Account —</option>
          {banks.map(b => <option key={b.id} value={b.id}>{b.nickname}</option>)}
        </select>
      </div>

      <div style={{ marginTop: '8px' }}>
        <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Defaults'}</PrimaryButton>
        {saved && <SavedBadge />}
      </div>
    </form>
  )
}
