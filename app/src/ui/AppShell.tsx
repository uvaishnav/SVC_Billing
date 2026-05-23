import React, { useState } from 'react'
import SettingsPage from './settings/SettingsPage'
import ClientsPage from './clients/ClientsPage'

type Tab = 'clients' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'clients', label: 'Clients', icon: '👤' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('clients')

  return (
    <div className="min-h-screen bg-[#F5F1E8] flex flex-col">
      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'clients' && <ClientsPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </div>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#3B2A1F] border-t border-[#C8A96A]/20 pb-safe">
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex-1 flex flex-col items-center justify-center py-3 gap-0.5 min-h-[56px] transition-colors',
                activeTab === tab.id
                  ? 'text-[#C8A96A]'
                  : 'text-[#7A6A58] hover:text-[#C8A96A]/70',
              ].join(' ')}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
              {activeTab === tab.id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#C8A96A] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
