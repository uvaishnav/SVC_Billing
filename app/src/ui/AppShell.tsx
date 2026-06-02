import { useState, useCallback } from 'react'
import {
  LayoutDashboard,
  FileText,
  Users,
  ClipboardList,
  Settings,
} from 'lucide-react'
import DashboardPage   from './dashboard/DashboardPage'
import SettingsPage    from './settings/SettingsPage'
import ClientsPage     from './clients/ClientsPage'
import WorkOrdersPage  from './workorders/WorkOrdersPage'
import InvoicesPage    from './invoices/InvoicesPage'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'home' | 'invoices' | 'clients' | 'workorders' | 'settings'

const TABS: {
  id: Tab
  label: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
}[] = [
  { id: 'home',       label: 'Home',       Icon: LayoutDashboard },
  { id: 'invoices',   label: 'Invoices',   Icon: FileText        },
  { id: 'clients',    label: 'Clients',    Icon: Users           },
  { id: 'workorders', label: 'Work Orders',Icon: ClipboardList   },
  { id: 'settings',   label: 'Settings',   Icon: Settings        },
]

const NAV_HEIGHT = 64 // px

// ─── AppShell ─────────────────────────────────────────────────────────────────

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [prevTab,   setPrevTab]   = useState<Tab>('home')

  const handleTabChange = useCallback((id: Tab) => {
    if (id === activeTab) return
    setPrevTab(activeTab)
    setActiveTab(id)
  }, [activeTab])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        background: 'var(--color-bg)',
      }}
    >
      {/* ── Scrollable content ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: `calc(${NAV_HEIGHT}px + var(--safe-bottom))`,
          WebkitOverflowScrolling: 'touch' as any,
        }}
      >
        {/*
          We render all pages but hide inactive ones with visibility:hidden +
          height:0 so state is preserved. The active page gets the tab-enter
          animation class on each tab change.
        */}
        <TabPage id="home"       active={activeTab === 'home'}       prev={prevTab}><DashboardPage /></TabPage>
        <TabPage id="invoices"   active={activeTab === 'invoices'}   prev={prevTab}><InvoicesPage /></TabPage>
        <TabPage id="clients"    active={activeTab === 'clients'}    prev={prevTab}><ClientsPage /></TabPage>
        <TabPage id="workorders" active={activeTab === 'workorders'} prev={prevTab}><WorkOrdersPage /></TabPage>
        <TabPage id="settings"   active={activeTab === 'settings'}   prev={prevTab}><SettingsPage /></TabPage>
      </div>

      {/* ── Bottom Navigation Bar ── */}
      <BottomNavBar activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}

// ─── TabPage ──────────────────────────────────────────────────────────────────

function TabPage({
  id, active, prev, children,
}: {
  id: Tab; active: boolean; prev: Tab; children: React.ReactNode
}) {
  // Use display:none only when never visited — otherwise keep in DOM for state
  return (
    <div
      key={`${prev}->${id}`}
      style={{
        display: active ? 'block' : 'none',
      }}
      className={active ? 'tab-page' : undefined}
    >
      {children}
    </div>
  )
}

// ─── BottomNavBar ────────────────────────────────────────────────────────────

function BottomNavBar({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab
  onTabChange: (id: Tab) => void
}) {
  return (
    <nav
      aria-label="Main navigation"
      style={{
        position:      'fixed',
        bottom:        0,
        left:          0,
        right:         0,
        height:        `calc(${NAV_HEIGHT}px + var(--safe-bottom))`,
        paddingBottom: 'var(--safe-bottom)',
        paddingLeft:   'var(--safe-left)',
        paddingRight:  'var(--safe-right)',
        background:    'var(--nav-bg)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop:     '1px solid rgba(59, 42, 31, 0.08)',
        boxShadow:     'var(--shadow-nav)',
        display:       'flex',
        zIndex:        100,
      }}
    >
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <NavTab
            key={tab.id}
            tab={tab}
            isActive={isActive}
            onPress={() => onTabChange(tab.id)}
          />
        )
      })}
    </nav>
  )
}

// ─── NavTab ───────────────────────────────────────────────────────────────────

function NavTab({
  tab,
  isActive,
  onPress,
}: {
  tab: typeof TABS[number]
  isActive: boolean
  onPress: () => void
}) {
  const { Icon, label } = tab

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      aria-selected={isActive}
      role="tab"
      style={{
        flex:           1,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '3px',
        border:         'none',
        background:     'transparent',
        cursor:         'pointer',
        padding:        '6px 4px',
        position:       'relative',
        minHeight:      '44px',
        minWidth:       '44px',
        /* Override global button spring so tab transitions feel snappier */
        transition:     'color 160ms var(--ease-out)',
        color: isActive ? 'var(--color-primary)' : 'var(--color-text-faint)',
      }}
    >
      {/* Active indicator pill behind icon */}
      {isActive && (
        <span
          aria-hidden="true"
          style={{
            position:     'absolute',
            top:          '6px',
            left:         '50%',
            transform:    'translateX(-50%)',
            width:        '40px',
            height:       '28px',
            background:   'rgba(200, 169, 106, 0.15)',
            borderRadius: '10px',
            transition:   'opacity var(--duration-fast) var(--ease-out)',
          }}
        />
      )}

      {/* Icon */}
      <Icon
        size={22}
        strokeWidth={isActive ? 2.2 : 1.8}
        aria-hidden="true"
      />

      {/* Label */}
      <span
        style={{
          fontSize:      '10px',
          fontWeight:    isActive ? 600 : 400,
          letterSpacing: isActive ? '0.1px' : '0px',
          fontFamily:    'Work Sans, sans-serif',
          lineHeight:    1,
        }}
      >
        {label}
      </span>
    </button>
  )
}
