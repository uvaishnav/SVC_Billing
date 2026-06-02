import { useEffect, useState } from 'react'
import BusinessProfileForm from './BusinessProfileForm'
import BankAccountsSection from './BankAccountsSection'
import SacCodesSection from './SacCodesSection'
import BillingDefaultsForm from './BillingDefaultsForm'
import VehiclesPage from '../vehicles/VehiclesPage'
import ProjectsPage from '../projects/ProjectsPage'
import { getSettings } from '../../db/settingsDb'
import type { Settings } from '../../db/types'

type Tab = 'profile' | 'bank' | 'sac' | 'defaults' | 'vehicles' | 'projects'

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile',  label: 'Business' },
  { id: 'bank',     label: 'Banks'    },
  { id: 'sac',      label: 'SAC Codes'},
  { id: 'defaults', label: 'Defaults' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'projects', label: 'Projects' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [settings,  setSettings]  = useState<Settings | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setLoading(false) })
  }, [])

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>

      {/* ── Sticky header ── */}
      <div
        style={{
          background:     'var(--topbar-bg)',
          padding:        'calc(16px + var(--safe-top)) calc(20px + var(--safe-right)) 0 calc(20px + var(--safe-left))',
          position:       'sticky',
          top:            0,
          zIndex:         10,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom:   '1px solid rgba(200, 169, 106, 0.15)',
        }}
      >
        <h1
          style={{
            color:      'var(--color-text-inverse)',
            fontSize:   '24px',
            fontFamily: 'DM Serif Display, Georgia, serif',
            fontWeight: 400,
            marginBottom: '16px',
          }}
        >
          Settings
        </h1>

        {/* Segmented Tab Bar */}
        <div style={{ position: 'relative', margin: '0 -20px', padding: '0 20px' }}>
          <div
            style={{
              display:    'flex',
              gap:        '4px',
              overflowX:  'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              paddingBottom: '4px',
            }}
          >
            {TABS.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex:         '1',
                    minWidth:     'max-content',
                    padding:      '10px 16px',
                    background:   isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color:        isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                    fontWeight:   isActive ? 600 : 400,
                    fontSize:     '14px',
                    border:       'none',
                    borderBottom: isActive
                      ? '2px solid rgba(200, 169, 106, 0.95)'
                      : '2px solid transparent',
                    cursor:       'pointer',
                    borderRadius: '0',
                    fontFamily:   'Work Sans, sans-serif',
                    transition:   'color 160ms, border-color 160ms, background 160ms',
                    minHeight:    '44px',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
            <div style={{ minWidth: '32px', flexShrink: 0 }} />
          </div>
          {/* Subtle fade overlay on right */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '40px',
              background: 'linear-gradient(to right, transparent, var(--color-primary))',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        </div>
      </div>

      {/* ── Content area ── */}
      <div
        style={{
          maxWidth: '640px',
          margin:   '0 auto',
          padding:  `24px calc(20px + var(--safe-right)) 48px calc(20px + var(--safe-left))`,
        }}
      >
        {loading ? (
          <SettingsSkeleton />
        ) : (
          <>
            {activeTab === 'profile'  && <BusinessProfileForm settings={settings} onSaved={setSettings} />}
            {activeTab === 'bank'     && <BankAccountsSection settings={settings} onSettingsUpdate={setSettings} />}
            {activeTab === 'sac'      && <SacCodesSection settings={settings} onSettingsUpdate={setSettings} />}
            {activeTab === 'defaults' && <BillingDefaultsForm settings={settings} onSaved={setSettings} />}
            {activeTab === 'vehicles' && <VehiclesPage embedded />}
            {activeTab === 'projects' && <ProjectsPage embedded />}
          </>
        )}
      </div>
    </div>
  )
}

// ── Skeleton loading state ────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div style={{ paddingTop: '8px' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ marginBottom: '20px' }}>
          <div className="skeleton" style={{ height: '12px', width: '80px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ height: '52px', width: '100%', borderRadius: 'var(--radius-md)' }} />
        </div>
      ))}
      <div className="skeleton" style={{ height: '52px', width: '100%', borderRadius: 'var(--radius-md)', marginTop: '8px' }} />
    </div>
  )
}
