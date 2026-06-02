import { useState, useCallback } from 'react'
import DashboardPage from './dashboard/DashboardPage'
import SettingsPage from './settings/SettingsPage'
import ClientsPage from './clients/ClientsPage'
import VehiclesPage from './vehicles/VehiclesPage'
import WorkOrdersPage from './workorders/WorkOrdersPage'
import ProjectsPage from './projects/ProjectsPage'
import InvoicesPage from './invoices/InvoicesPage'

type Tab = 'home' | 'invoices' | 'clients' | 'vehicles' | 'workorders' | 'projects' | 'settings'

// ─── SVG Icons (inline — no CDN dependency, consistent across iOS versions) ───

const Icons: Record<Tab, JSX.Element> = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  ),
  invoices: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <line x1="8" y1="8" x2="16" y2="8"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
      <line x1="8" y1="16" x2="12" y2="16"/>
    </svg>
  ),
  clients: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  vehicles: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="9" width="22" height="9" rx="2"/>
      <path d="M5 9V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>
      <circle cx="7" cy="18" r="2"/>
      <circle cx="17" cy="18" r="2"/>
    </svg>
  ),
  workorders: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <path d="M8 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2"/>
      <line x1="8" y1="10" x2="16" y2="10"/>
      <line x1="8" y1="14" x2="14" y2="14"/>
    </svg>
  ),
  projects: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ),
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'home',       label: 'Home'       },
  { id: 'invoices',   label: 'Invoices'   },
  { id: 'clients',    label: 'Clients'    },
  { id: 'vehicles',   label: 'Vehicles'   },
  { id: 'workorders', label: 'Orders'     },
  { id: 'projects',   label: 'Projects'   },
  { id: 'settings',   label: 'Settings'   },
]

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [animKey, setAnimKey] = useState(0)

  const handleTabChange = useCallback((id: Tab) => {
    if (id === activeTab) return
    setActiveTab(id)
    setAnimKey(k => k + 1)
  }, [activeTab])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--color-bg)' }}>

      {/* Scrollable content — padding-bottom matches nav height (incl. safe area) */}
      <div className="scroll-area">
        <div key={animKey} className="page-enter">
          {activeTab === 'home'       && <DashboardPage />}
          {activeTab === 'invoices'   && <InvoicesPage />}
          {activeTab === 'clients'    && <ClientsPage />}
          {activeTab === 'vehicles'   && <VehiclesPage />}
          {activeTab === 'workorders' && <WorkOrdersPage />}
          {activeTab === 'projects'   && <ProjectsPage />}
          {activeTab === 'settings'   && <SettingsPage />}
        </div>
      </div>

      {/* ─── Bottom Tab Bar ─────────────────────────────────── */}
      <nav className="tab-bar" role="tablist" aria-label="Main navigation">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          const activeColor  = 'var(--color-accent)'   // gold
          const inactiveColor = 'rgba(184,169,154,0.65)' // muted warm

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => handleTabChange(tab.id)}
              className={`tab-btn${isActive ? ' active' : ''}`}
            >
              {/* Active pip */}
              {isActive && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '20px',
                  height: '2.5px',
                  background: 'var(--color-accent)',
                  borderRadius: '0 0 3px 3px',
                  boxShadow: '0 0 6px rgba(200,169,106,0.5)',
                }} />
              )}

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
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
