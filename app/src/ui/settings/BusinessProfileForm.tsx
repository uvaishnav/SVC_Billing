import { useState, useEffect } from 'react'
import { upsertSettings } from '../../db/settingsDb'
import type { Settings } from '../../db/types'
import { Field, PrimaryButton, SavedBadge, sectionTitleStyle } from './_components'

interface Props { settings: Settings | null; onSaved: (s: Settings) => void }

export default function BusinessProfileForm({ settings, onSaved }: Props) {
  const [form, setForm] = useState({
    business_name: '', address: '', gstin: '', pan: '',
    state: 'Andhra Pradesh', state_code: '37',
    phone: '', email: '', authorized_signatory: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) setForm({
      business_name: settings.business_name ?? '',
      address: settings.address ?? '',
      gstin: settings.gstin ?? '',
      pan: settings.pan ?? '',
      state: settings.state ?? 'Andhra Pradesh',
      state_code: settings.state_code ?? '37',
      phone: settings.phone ?? '',
      email: settings.email ?? '',
      authorized_signatory: settings.authorized_signatory ?? '',
    })
  }, [settings])

  const set = (field: keyof typeof form) => (v: string) => {
    setForm(p => ({ ...p, [field]: v })); setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const updated = await upsertSettings(form)
    if (updated) { onSaved(updated); setSaved(true) }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={sectionTitleStyle}>Business Identity</p>
      <Field label="Business Name" value={form.business_name} onChange={set('business_name')} placeholder="Sri Vaishnav Constructions" required />
      <Field label="Full Address" value={form.address} onChange={set('address')} placeholder="2-14, Godavarru, Kankipadu Mandal, Krishna District, Andhra Pradesh 521 344" required rows={3} />

      <p style={{ ...sectionTitleStyle, marginTop: '24px' }}>Tax Details</p>
      <Field label="GSTIN" value={form.gstin} onChange={set('gstin')} placeholder="37ADUPU2453N1ZK" required />
      <Field label="PAN" value={form.pan} onChange={set('pan')} placeholder="ADUPU2453N" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="State" value={form.state} onChange={set('state')} placeholder="Andhra Pradesh" required />
        <Field label="State Code" value={form.state_code} onChange={set('state_code')} placeholder="37" required />
      </div>

      <p style={{ ...sectionTitleStyle, marginTop: '24px' }}>Contact</p>
      <Field label="Phone" value={form.phone} onChange={set('phone')} placeholder="+91 XXXXX XXXXX" type="tel" />
      <Field label="Email" value={form.email} onChange={set('email')} placeholder="office@example.com" type="email" />

      <p style={{ ...sectionTitleStyle, marginTop: '24px' }}>Invoice Signatory</p>
      <Field label="Authorized Signatory Name" value={form.authorized_signatory} onChange={set('authorized_signatory')} placeholder="Uppalapati Surekha" required />

      <div style={{ marginTop: '8px' }}>
        <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Business Profile'}</PrimaryButton>
        {saved && <SavedBadge />}
      </div>
    </form>
  )
}
