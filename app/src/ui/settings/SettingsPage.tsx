import { useState, useEffect } from 'react'
import { getSettings } from '../../db/settingsDb'
import type { Settings } from '../../db/types'
import BusinessProfileForm from './BusinessProfileForm'
import BillingDefaultsForm from './BillingDefaultsForm'
import BankAccountsSection from './BankAccountsSection'
import SacCodesSection from './SacCodesSection'

type Tab = 'profile' | 'defaults' | 'bank' | 'sac'

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile',  label: 'Business' },
  { id: 'defaults', label: 'Defaults' },
  { id: 'bank',     label: 'Bank' },
  { id: 'sac',      label: 'SAC Codes' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [settings,  setSettings]  = useState<Settings | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: 'var(--color-text-muted)', fontSize: 15, fontFamily: 'Work Sans, sans-serif' }}>
        Loading settings…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--color-bg)', overflow: 'hidden' }}>

      {/* Page header */}
      <div className="page-header" style={{
        background: 'var(--color-primary)',
        paddingTop: 'calc(20px + var(--safe-top, 0px))',
        paddingBottom: '0',
        paddingLeft: '20px',
        paddingRight: '20px',
        flexShrink: 0,
      }}>
        <h1 style={{ color: 'var(--color-bg)', fontSize: '24px', fontFamily: 'Playfair Display, serif', marginBottom: '16px' }}>Settings</h1>

        {/* Pill tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '14px', scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '7px 18px',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontFamily: 'Work Sans, sans-serif',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                background: activeTab === tab.id ? 'rgba(255,255,255,0.22)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.60)',
                transition: 'background 0.18s, color 0.18s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {activeTab === 'profile'  && <BusinessProfileForm settings={settings} onSaved={setSettings} />}
        {activeTab === 'defaults' && <BillingDefaultsForm settings={settings} onSaved={setSettings} />}
        {activeTab === 'bank'     && <BankAccountsSection settings={settings} onSettingsUpdate={setSettings} />}
        {activeTab === 'sac'      && <SacCodesSection     settings={settings} onSettingsUpdate={setSettings} />}
      </div>
    </div>
  )
}
