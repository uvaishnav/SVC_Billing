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
type PrimaryTab = 'home' | 'invoices' | 'clients' | 'more'

// ─── SVG Icons (Apple HIG inspired active & inactive icons) ───

function TabIcon({ id, active }: { id: PrimaryTab; active: boolean }) {
  if (id === 'home') {
    return active ? (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.26 2.45a1 1 0 0 1 1.48 0l8.5 7.65A1 1 0 0 1 21.5 11v9a1.5 1.5 0 0 1-1.5 1.5h-4a1 1 0 0 1-1-1v-6h-6v6a1 1 0 0 1-1 1H4A1.5 1.5 0 0 1 2.5 20v-9a1 1 0 0 1 .26-.68l8.5-7.87z" />
      </svg>
    ) : (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.2L12 3l9 7.2V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V10.2z" />
        <path d="M9 21.5V12h6v9.5" />
      </svg>
    )
  }

  if (id === 'invoices') {
    return active ? (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      </svg>
    ) : (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="8" y1="16" x2="13" y2="16" />
      </svg>
    )
  }

  if (id === 'clients') {
    return active ? (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="7.5" r="4.2" />
        <path d="M12 13.5c-4.4 0-8 2.4-8 6.2 0 .7.58 1.3 1.3 1.3h13.4c.72 0 1.3-.6 1.3-1.3 0-3.8-3.6-6.2-8-6.2z" />
      </svg>
    ) : (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7.5" r="4" />
        <path d="M4 20.5c0-4 3.58-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    )
  }

  // more
  return active ? (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="19" cy="12" r="2.2" />
    </svg>
  ) : (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}

const PRIMARY_TABS: { id: PrimaryTab; label: string }[] = [
  { id: 'home',     label: 'Home'     },
  { id: 'invoices', label: 'Invoices' },
  { id: 'clients',  label: 'Clients'  },
  { id: 'more',     label: 'More'     },
]

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [animKey, setAnimKey] = useState(0)

  const isSubTab = activeTab === 'vehicles' || activeTab === 'projects' || activeTab === 'settings' || activeTab === 'workorders'
  const effectivePrimaryTab: PrimaryTab = isSubTab ? 'more' : (activeTab as PrimaryTab)

  const handleTabChange = useCallback((id: PrimaryTab) => {
    // If tapping "more" while already in a sub-view (vehicles, projects, settings, workorders), return to more hub
    if (id === 'more' && isSubTab) {
      setActiveTab('more')
      setAnimKey(k => k + 1)
      return
    }
    if (id === activeTab) return
    setActiveTab(id)
    setAnimKey(k => k + 1)
  }, [activeTab, isSubTab])

  const handleNavigateSubTab = useCallback((sub: 'workorders' | 'vehicles' | 'projects' | 'settings') => {
    setActiveTab(sub)
    setAnimKey(k => k + 1)
  }, [])

  const handleBackToMore = useCallback(() => {
    setActiveTab('more')
    setAnimKey(k => k + 1)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--color-bg)', position: 'relative' }}>

      {/* Scrollable content */}
      <div className="scroll-area">
        <div key={animKey} className="page-enter">
          {activeTab === 'home'       && <DashboardPage />}
          {activeTab === 'invoices'   && <InvoicesPage />}
          {activeTab === 'workorders' && <WorkOrdersPage onBack={handleBackToMore} />}
          {activeTab === 'clients'    && <ClientsPage />}
          {activeTab === 'more'       && <MoreHubView onNavigate={handleNavigateSubTab} />}
          {activeTab === 'vehicles'   && <VehiclesPage onBack={handleBackToMore} />}
          {activeTab === 'projects'   && <ProjectsPage onBack={handleBackToMore} />}
          {activeTab === 'settings'   && <SettingsPage onBack={handleBackToMore} />}
        </div>
      </div>

      {/* ─── Apple HIG iOS Bottom Tab Bar (4 items: Home, Invoices, Clients, More) ─── */}
      <nav className="tab-bar" role="tablist" aria-label="Main navigation">
        {PRIMARY_TABS.map(tab => {
          const isActive = effectivePrimaryTab === tab.id
          const activeColor   = 'var(--color-primary)'    // Deep espresso
          const inactiveColor = 'var(--color-text-muted)'  // Warm muted slate

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => handleTabChange(tab.id)}
              className={`tab-btn${isActive ? ' active' : ''}`}
            >
              {/* Icon with comfortable breathing room */}
              <span
                className="tab-icon"
                style={{ color: isActive ? activeColor : inactiveColor }}
              >
                <TabIcon id={tab.id} active={isActive} />
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

              {/* Refined Gold Active Pip — fixed slot prevents height jitter / label jumping */}
              <span
                className="tab-pip"
                style={{
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? 'scale(1)' : 'scale(0.4)',
                }}
              />
            </button>
          )
        })}
      </nav>
    </div>
  )
}
