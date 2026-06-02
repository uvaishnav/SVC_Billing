import { useMemo, useState } from 'react'
import CompanyProfileTab from './CompanyProfileTab'
import BillingProfileTab from './BillingProfileTab'
import NumberingTab from './NumberingTab'
import BrandingTab from './BrandingTab'
import BackupTab from './BackupTab'

const TABS = [
  { id: 'company',   label: 'Company' },
  { id: 'billing',   label: 'Billing' },
  { id: 'numbering', label: 'Numbering' },
  { id: 'branding',  label: 'Branding' },
  { id: 'backup',    label: 'Backup' },
] as const

type TabId = typeof TABS[number]['id']

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('company')

  const Content = useMemo(() => {
    switch (activeTab) {
      case 'company':   return CompanyProfileTab
      case 'billing':   return BillingProfileTab
      case 'numbering': return NumberingTab
      case 'branding':  return BrandingTab
      case 'backup':    return BackupTab
    }
  }, [activeTab])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      {/* Top header */}
      <div className="page-header" style={{ background: 'var(--color-primary)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ color: 'var(--color-bg)', fontSize: '22px', fontFamily: 'Playfair Display, serif', marginBottom: '16px' }}>Settings</h1>
        {/* Tab bar */}
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
                  background: active ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                  color: active ? 'var(--color-primary)' : 'var(--color-bg)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Work Sans, sans-serif',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 40px' }}>
        <Content />
      </div>
    </div>
  )
}
