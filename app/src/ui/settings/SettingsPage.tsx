import React, { useEffect, useState } from 'react'
import BusinessProfileForm from './BusinessProfileForm'
import BankAccountsSection from './BankAccountsSection'
import SacCodesSection from './SacCodesSection'
import BillingDefaultsForm from './BillingDefaultsForm'
import { getSettings } from '../../db/settingsDb'
import type { Settings } from '../../db/types'

type Tab = 'profile' | 'bank' | 'sac' | 'defaults'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'profile',  label: 'Business',  icon: '🏢' },
  { id: 'bank',     label: 'Banks',     icon: '🏦' },
  { id: 'sac',      label: 'SAC Codes', icon: '📋' },
  { id: 'defaults', label: 'Defaults',  icon: '⚙️' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setLoading(false) })
  }, [])

  return (
    <div style={{ minHeight: '100svh', background: 'var(--color-bg)' }}>
      {/* Top header */}
      <div style={{ background: 'var(--color-primary)', padding: '20px 20px 0', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ color: 'var(--color-bg)', fontSize: '22px', fontFamily: 'Playfair Display, serif', marginBottom: '16px' }}>Settings</h1>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '0' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: '1', minWidth: 'max-content', padding: '10px 14px',
                background: activeTab === tab.id ? 'var(--color-bg)' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-faint)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                fontSize: '14px', border: 'none', cursor: 'pointer',
                borderRadius: '10px 10px 0 0',
                transition: 'all 0.15s',
                fontFamily: 'Work Sans, sans-serif',
              }}
            >
              <span style={{ marginRight: '6px' }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 20px 48px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>Loading settings…</div>
          </div>
        ) : (
          <>
            {activeTab === 'profile'  && <BusinessProfileForm settings={settings} onSaved={setSettings} />}
            {activeTab === 'bank'     && <BankAccountsSection settings={settings} onSettingsUpdate={setSettings} />}
            {activeTab === 'sac'      && <SacCodesSection settings={settings} onSettingsUpdate={setSettings} />}
            {activeTab === 'defaults' && <BillingDefaultsForm settings={settings} onSaved={setSettings} />}
          </>
        )}
      </div>
    </div>
  )
}
