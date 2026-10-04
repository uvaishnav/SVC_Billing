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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', minHeight: '200px', color: 'var(--color-text-muted)', fontSize: 15, fontFamily: 'Work Sans, sans-serif' }}>
        Loading settings…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      {/* Page header */}
      <div className="page-header">
        <h1 style={{ color: 'var(--color-primary)', fontSize: '22px', fontWeight: 700, fontFamily: 'Playfair Display, Georgia, serif', margin: 0, marginBottom: '14px' }}>Settings</h1>

        {/* Pill tabs */}
        <div
          role="tablist"
          aria-label="Settings sections"
          style={{
            display: 'flex',
            gap: '4px',
            overflowX: 'auto',
            padding: '3px',
            background: 'rgba(237, 233, 222, 0.75)',
            borderRadius: '12px',
            scrollbarWidth: 'none',
          }}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`settings-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`settings-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: 'Work Sans, sans-serif',
                  fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap',
                  flex: 1,
                  textAlign: 'center',
                  background: isActive ? '#FFFFFF' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: isActive ? '0 1px 4px rgba(59,42,31,0.08)' : 'none',
                  transition: 'background 0.18s, color 0.18s',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: '20px' }}>
        {TABS.map(tab => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`settings-panel-${tab.id}`}
            aria-labelledby={`settings-tab-${tab.id}`}
            hidden={activeTab !== tab.id}
          >
            {activeTab === tab.id && (
              <>
                {tab.id === 'profile'  && <BusinessProfileForm settings={settings} onSaved={setSettings} />}
                {tab.id === 'defaults' && <BillingDefaultsForm settings={settings} onSaved={setSettings} />}
                {tab.id === 'bank'     && <BankAccountsSection settings={settings} onSettingsUpdate={setSettings} />}
                {tab.id === 'sac'      && <SacCodesSection     settings={settings} onSettingsUpdate={setSettings} />}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
