import React, { useState, useEffect } from 'react'
import { upsertSettings } from '../../db/settingsDb'
import type { Settings } from '../../db/types'

interface Props {
  settings: Settings | null
  onSaved: (s: Settings) => void
}

export default function BusinessProfileForm({ settings, onSaved }: Props) {
  const [form, setForm] = useState({
    business_name: '',
    address: '',
    gstin: '',
    pan: '',
    state: 'Andhra Pradesh',
    state_code: '37',
    phone: '',
    email: '',
    authorized_signatory: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
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
    }
  }, [settings])

  function handleChange(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const updated = await upsertSettings(form)
    if (updated) { onSaved(updated); setSaved(true) }
    setSaving(false)
  }

  const Field = ({ label, field, placeholder, required = false, type = 'text' }: {
    label: string; field: keyof typeof form; placeholder?: string; required?: boolean; type?: string
  }) => (
    <div>
      <label className="block text-sm font-medium text-[#3B2A1F] mb-1">
        {label}{required && <span className="text-[#8B2E2E] ml-1">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={form[field]}
        onChange={e => handleChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-[#D9D3C5] bg-[#FAF8F3] text-[#2A1F15] focus:outline-none focus:ring-2 focus:ring-[#C8A96A] text-base"
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Business Name" field="business_name" placeholder="Sri Vaishnav Constructions" required />
      <div>
        <label className="block text-sm font-medium text-[#3B2A1F] mb-1">Address<span className="text-[#8B2E2E] ml-1">*</span></label>
        <textarea
          required
          value={form.address}
          onChange={e => handleChange('address', e.target.value)}
          placeholder="Full address including district, state and pincode"
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-[#D9D3C5] bg-[#FAF8F3] text-[#2A1F15] focus:outline-none focus:ring-2 focus:ring-[#C8A96A] text-base resize-none"
        />
      </div>
      <Field label="GSTIN" field="gstin" placeholder="37ADUPU2453N1ZK" required />
      <Field label="PAN" field="pan" placeholder="ADUPU2453N" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="State" field="state" placeholder="Andhra Pradesh" required />
        <Field label="State Code" field="state_code" placeholder="37" required />
      </div>
      <Field label="Phone" field="phone" placeholder="+91 XXXXX XXXXX" type="tel" />
      <Field label="Email" field="email" placeholder="business@email.com" type="email" />
      <Field label="Authorized Signatory" field="authorized_signatory" placeholder="Uppalapati Surekha" required />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-3 bg-[#3B2A1F] text-[#F5F1E8] font-semibold rounded-xl text-base active:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
        {saved && <span className="text-[#5A7A2E] text-sm font-medium">✓ Saved</span>}
      </div>
    </form>
  )
}
