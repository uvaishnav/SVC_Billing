import { useState } from 'react'
import BusinessProfileForm from './BusinessProfileForm'
import BillingDefaultsForm from './BillingDefaultsForm'
import BankAccountsSection from './BankAccountsSection'
import SacCodesSection from './SacCodesSection'

const TABS = [
  { id: 'company',  label: 'Company'  },
  { id: 'billing',  label: 'Billing'  },
  { id: 'bank',     label: 'Bank'     },
  { id: 'sac',      label: 'SAC Codes'},
] as const

type TabId = typeof TABS[number]['id']

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('company')

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>

      {/* ─── Sticky header ─── */}
      <div
        className="page-header"
        style={{
          background: 'var(--color-primary)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <h1 style={{
          color: 'var(--color-bg)',
          fontSize: '22px',
          fontFamily: 'Playfair Display, serif',
          marginBottom: '16px',
        }}>Settings</h1>

        {/* Tab pills */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '0' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flexShrink: 0,
                  border: 'none',
                  borderRadius: '999px',
                  padding: '10px 14px',
                  minHeight: '44px',
                  background: active ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                  color: active ? 'var(--color-primary)' : 'var(--color-bg)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Work Sans, sans-serif',
                  transition: 'background 200ms, color 200ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 40px' }}>
        {activeTab === 'company' && <BusinessProfileForm />}
        {activeTab === 'billing' && <BillingDefaultsForm />}
        {activeTab === 'bank'    && <BankAccountsSection />}
        {activeTab === 'sac'     && <SacCodesSection />}
      </div>
    </div>
  )
}
