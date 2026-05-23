import React, { useEffect, useState } from 'react'
import BusinessProfileForm from './BusinessProfileForm'
import BankAccountsSection from './BankAccountsSection'
import SacCodesSection from './SacCodesSection'
import BillingDefaultsForm from './BillingDefaultsForm'
import { getSettings } from '../../db/settingsDb'
import type { Settings } from '../../db/types'

type Tab = 'profile' | 'bank' | 'sac' | 'defaults'

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Business Profile' },
  { id: 'bank', label: 'Bank Accounts' },
  { id: 'sac', label: 'SAC Codes' },
  { id: 'defaults', label: 'Billing Defaults' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#7A6A58]">Loading settings…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-['Playfair_Display'] text-2xl font-bold text-[#3B2A1F] mb-6">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[#EDE9DE] rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-max px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#3B2A1F] text-[#F5F1E8]'
                : 'text-[#7A6A58] active:bg-[#D9D3C5]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile' && (
        <BusinessProfileForm settings={settings} onSaved={setSettings} />
      )}
      {activeTab === 'bank' && <BankAccountsSection settings={settings} onSettingsUpdate={setSettings} />}
      {activeTab === 'sac' && <SacCodesSection settings={settings} onSettingsUpdate={setSettings} />}
      {activeTab === 'defaults' && (
        <BillingDefaultsForm settings={settings} onSaved={setSettings} />
      )}
    </div>
  )
}
