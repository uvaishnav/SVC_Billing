import { useState } from 'react'
import DashboardPage from './dashboard/DashboardPage'
import SettingsPage from './settings/SettingsPage'
import ClientsPage from './clients/ClientsPage'
import VehiclesPage from './vehicles/VehiclesPage'
import WorkOrdersPage from './workorders/WorkOrdersPage'
import ProjectsPage from './projects/ProjectsPage'
import InvoicesPage from './invoices/InvoicesPage'

type Tab = 'home' | 'invoices' | 'clients' | 'vehicles' | 'workorders' | 'projects' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',       label: 'Home',       icon: '🏠' },
  { id: 'invoices',   label: 'Invoices',   icon: '📄' },
  { id: 'clients',    label: 'Clients',    icon: '👤' },
  { id: 'vehicles',   label: 'Vehicles',   icon: '🚛' },
  { id: 'workorders', label: 'Work Orders', icon: '📋' },
  { id: 'projects',   label: 'Projects',   icon: '📁' },
  { id: 'settings',   label: 'Settings',   icon: '⚙️' },
]

const NAV_HEIGHT = 64

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('home')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--color-bg)' }}>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: `calc(${NAV_HEIGHT}px + var(--safe-bottom))` }}>
        {activeTab === 'home'       && <DashboardPage />}
        {activeTab === 'invoices'   && <InvoicesPage />}
        {activeTab === 'clients'    && <ClientsPage />}
        {activeTab === 'vehicles'   && <VehiclesPage />}
        {activeTab === 'workorders' && <WorkOrdersPage />}
        {activeTab === 'projects'   && <ProjectsPage />}
        {activeTab === 'settings'   && <SettingsPage />}
      </div>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: `calc(${NAV_HEIGHT}px + var(--safe-bottom))`,
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
        background: 'var(--nav-bg)',
        borderTop: '1px solid var(--color-border)',
        backdropFilter: 'blur(18px)',
        display: 'flex',
        zIndex: 100,
        overflowX: 'auto',
        boxShadow: '0 -8px 24px rgba(20,14,8,0.12)',
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                minWidth: 64,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '6px 4px',
                position: 'relative',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
            >
              {isActive && (
                <span style={{
                  position: 'absolute', top: 4, left: '50%',
                  transform: 'translateX(-50%)',
                  width: '32px', height: '2px',
                  background: 'var(--color-accent)',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              <span style={{ fontSize: '18px', lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: '11px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontFamily: 'Work Sans, sans-serif',
                letterSpacing: '0.2px',
              }}>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
