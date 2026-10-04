import { useState, useCallback, type ReactNode } from 'react'
import DashboardPage from './dashboard/DashboardPage'
import SettingsPage from './settings/SettingsPage'
import ClientsPage from './clients/ClientsPage'
import VehiclesPage from './vehicles/VehiclesPage'
import WorkOrdersPage from './workorders/WorkOrdersPage'
import ProjectsPage from './projects/ProjectsPage'
import InvoicesPage from './invoices/InvoicesPage'
import MoreHubView from './more/MoreHubView'

type Tab = 'home' | 'invoices' | 'workorders' | 'clients' | 'more' | 'vehicles' | 'projects' | 'settings'
type PrimaryTab = 'home' | 'invoices' | 'workorders' | 'clients' | 'more'

// ─── SVG Icons (Apple HIG 22x22 outline icons) ───

const Icons: Record<PrimaryTab, ReactNode> = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  ),
  invoices: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <line x1="8" y1="8" x2="16" y2="8"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
      <line x1="8" y1="16" x2="12" y2="16"/>
    </svg>
  ),
  workorders: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <path d="M8 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2"/>
      <line x1="8" y1="10" x2="16" y2="10"/>
      <line x1="8" y1="14" x2="14" y2="14"/>
    </svg>
  ),
  clients: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  more: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1.5"/>
      <circle cx="19" cy="12" r="1.5"/>
      <circle cx="5" cy="12" r="1.5"/>
    </svg>
  ),
}

const PRIMARY_TABS: { id: PrimaryTab; label: string }[] = [
  { id: 'home',       label: 'Home'     },
  { id: 'invoices',   label: 'Invoices' },
  { id: 'workorders', label: 'Orders'   },
  { id: 'clients',    label: 'Clients'  },
  { id: 'more',       label: 'More'     },
]

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [animKey, setAnimKey] = useState(0)

  const handleTabChange = useCallback((id: PrimaryTab) => {
    // If tapping "more" while already in a sub-view (vehicles, projects, settings), return to more hub
    if (id === 'more' && (activeTab === 'vehicles' || activeTab === 'projects' || activeTab === 'settings')) {
      setActiveTab('more')
      setAnimKey(k => k + 1)
      return
    }
    if (id === activeTab) return
    setActiveTab(id)
    setAnimKey(k => k + 1)
  }, [activeTab])

  const handleNavigateSubTab = useCallback((sub: 'vehicles' | 'projects' | 'settings') => {
    setActiveTab(sub)
    setAnimKey(k => k + 1)
  }, [])

  const isSubTab = activeTab === 'vehicles' || activeTab === 'projects' || activeTab === 'settings'
  const effectivePrimaryTab: PrimaryTab = isSubTab ? 'more' : (activeTab as PrimaryTab)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--color-bg)', position: 'relative' }}>

      {/* Pinned iOS status bar backdrop — blends with frosted header seamlessly, no white glare */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 'var(--safe-top)',
          background: 'rgba(245, 241, 232, 0.94)',
          backdropFilter: 'blur(24px) saturate(190%)',
          WebkitBackdropFilter: 'blur(24px) saturate(190%)',
          zIndex: 99,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* Sub-tab Navigation Banner (when inside Vehicles, Projects, or Settings from More) */}
      {isSubTab && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 25,
          background: 'rgba(245, 241, 232, 0.95)',
          backdropFilter: 'blur(24px) saturate(190%)',
          WebkitBackdropFilter: 'blur(24px) saturate(190%)',
          paddingTop: 'calc(var(--safe-top) + 6px)',
          paddingBottom: '8px',
          paddingLeft: '16px',
          paddingRight: '16px',
          borderBottom: '1px solid rgba(59, 42, 31, 0.08)',
          display: 'flex',
          alignItems: 'center',
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('more'); setAnimKey(k => k + 1) }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px 4px 0',
              fontFamily: 'Work Sans, -apple-system, sans-serif',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Back to More</span>
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="scroll-area">
        <div key={animKey} className="page-enter">
          {activeTab === 'home'       && <DashboardPage />}
          {activeTab === 'invoices'   && <InvoicesPage />}
          {activeTab === 'workorders' && <WorkOrdersPage />}
          {activeTab === 'clients'    && <ClientsPage />}
          {activeTab === 'more'       && <MoreHubView onNavigate={handleNavigateSubTab} />}
          {activeTab === 'vehicles'   && <VehiclesPage />}
          {activeTab === 'projects'   && <ProjectsPage />}
          {activeTab === 'settings'   && <SettingsPage />}
        </div>
      </div>

      {/* ─── Apple HIG Frosted Glass Bottom Tab Bar (5 items) ─────────────────── */}
      <nav className="tab-bar" role="tablist" aria-label="Main navigation">
        {PRIMARY_TABS.map(tab => {
          const isActive = effectivePrimaryTab === tab.id
          const activeColor   = 'var(--color-primary)'   // Deep espresso
          const inactiveColor = 'var(--color-text-muted)' // Warm muted slate

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => handleTabChange(tab.id)}
              className={`tab-btn${isActive ? ' active' : ''}`}
            >
              {/* Icon */}
              <span
                className="tab-icon"
                style={{ color: isActive ? activeColor : inactiveColor }}
              >
                {Icons[tab.id]}
              </span>

              {/* Label */}
              <span
                className="tab-label"
                style={{
                  color: isActive ? activeColor : inactiveColor,
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {tab.label}
              </span>

              {/* Refined Gold Active Pip */}
              {isActive && (
                <span style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                  marginTop: '1px',
                  boxShadow: '0 0 4px rgba(200, 169, 106, 0.6)',
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
