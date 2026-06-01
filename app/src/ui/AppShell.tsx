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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh', background: 'var(--color-bg)' }}>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: NAV_HEIGHT }}>
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
        height: NAV_HEIGHT,
        background: 'var(--color-primary)',
        borderTop: '1px solid rgba(200,169,106,0.2)',
        display: 'flex',
        zIndex: 100,
        overflowX: 'auto',
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                minWidth: 48,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '2px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '8px 0',
                position: 'relative',
              }}
            >
              {isActive && (
                <span style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: '32px', height: '2px',
                  background: 'var(--color-accent)',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              <span style={{ fontSize: '18px', lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-faint)',
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
