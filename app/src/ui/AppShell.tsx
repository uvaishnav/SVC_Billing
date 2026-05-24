import React, { useState } from 'react'
import SettingsPage from './settings/SettingsPage'
import ClientsPage from './clients/ClientsPage'
import VehiclesPage from './vehicles/VehiclesPage'

type Tab = 'clients' | 'vehicles' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'clients',  label: 'Clients',  icon: '👤' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚛' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

const NAV_HEIGHT = 64

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('clients')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh', background: 'var(--color-bg)' }}>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: NAV_HEIGHT }}>
        {activeTab === 'clients'  && <ClientsPage />}
        {activeTab === 'vehicles' && <VehiclesPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </div>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: NAV_HEIGHT,
        background: 'var(--color-primary)',
        borderTop: '1px solid rgba(200,169,106,0.2)',
        display: 'flex',
        zIndex: 100,
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '4px',
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
              <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: '11px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-faint)',
                fontFamily: 'Work Sans, sans-serif',
                letterSpacing: '0.3px',
              }}>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
