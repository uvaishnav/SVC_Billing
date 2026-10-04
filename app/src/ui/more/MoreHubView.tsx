import { useState, type ReactNode } from 'react'
import OutstandingStatementModal from '../reports/OutstandingStatementModal'
import ErrorBoundary from '../common/ErrorBoundary'
import { supabase } from '../../db/supabaseClient'

interface MoreHubViewProps {
  onNavigate: (tab: 'vehicles' | 'projects' | 'settings') => void
}

interface MenuRowProps {
  icon: ReactNode
  iconBg: string
  iconColor: string
  title: string
  subtitle: string
  onClick: () => void
  isDanger?: boolean
}

function MenuRow({ icon, iconBg, iconColor, title, subtitle, onClick, isDanger }: MenuRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '14px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid rgba(217, 211, 197, 0.45)',
        cursor: 'pointer',
        textAlign: 'left',
        gap: '14px',
        transition: 'background 120ms ease',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={e => (e.currentTarget.style.background = 'rgba(200, 169, 106, 0.08)')}
      onPointerUp={e => (e.currentTarget.style.background = 'transparent')}
      onPointerLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '11px',
        background: iconBg,
        color: iconColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 6px rgba(59,42,31,0.06)',
      }}>
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '15px',
          fontWeight: 600,
          color: isDanger ? 'var(--color-error)' : 'var(--color-text)',
          fontFamily: 'Work Sans, -apple-system, sans-serif',
          lineHeight: 1.25,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--color-text-muted)',
          marginTop: '3px',
          fontFamily: 'Work Sans, -apple-system, sans-serif',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {subtitle}
        </div>
      </div>

      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(122, 106, 88, 0.45)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

export default function MoreHubView({ onNavigate }: MoreHubViewProps) {
  const [showStatementModal, setShowStatementModal] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    if (confirm('Are you sure you want to sign out?')) {
      setSigningOut(true)
      await supabase.auth.signOut()
    }
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)' }}>
      {/* ─── Apple HIG Frosted Sticky Header ─── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--color-primary)',
              margin: 0,
              fontFamily: 'Playfair Display, Georgia, serif',
            }}>
              More
            </h1>
            <p style={{
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              marginTop: '2px',
              fontFamily: 'Work Sans, sans-serif',
            }}>
              Operations, Fleet & System Configuration
            </p>
          </div>
        </div>
      </div>

      {/* ─── Grouped Content Sections (Apple Settings Style) ─── */}
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px', margin: '0 auto' }}>

        {/* Company Badge Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(250,248,243,0.9) 100%)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(217, 211, 197, 0.7)',
          boxShadow: '0 2px 10px rgba(59,42,31,0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '13px',
            background: 'var(--color-primary)',
            color: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 700,
            fontFamily: 'Playfair Display, serif',
            boxShadow: '0 2px 8px rgba(59,42,31,0.18)',
            flexShrink: 0,
          }}>
            S
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Playfair Display, serif' }}>
              Sri Vaishnav Constructions
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              GST Billing & Fleet Operations Hub
            </div>
          </div>
        </div>

        {/* Group 1: Operations & Fleet */}
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: 'var(--color-text-muted)',
            marginBottom: '8px',
            paddingLeft: '6px',
          }}>
            Operations & Fleet
          </div>

          <div style={{
            background: 'var(--color-surface-2, #FFFFFF)',
            borderRadius: '16px',
            border: '1px solid rgba(217, 211, 197, 0.7)',
            boxShadow: '0 2px 8px rgba(59,42,31,0.03)',
            overflow: 'hidden',
          }}>
            <MenuRow
              title="Vehicles & Machinery"
              subtitle="Fleet registration, equipment types & capacity"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="9" width="22" height="9" rx="2"/>
                  <path d="M5 9V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>
                  <circle cx="7" cy="18" r="2"/>
                  <circle cx="17" cy="18" r="2"/>
                </svg>
              }
              iconBg="rgba(42, 95, 138, 0.12)"
              iconColor="#2A5F8A"
              onClick={() => onNavigate('vehicles')}
            />

            <MenuRow
              title="Projects & Sites"
              subtitle="Client job locations, place of supply & works"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              }
              iconBg="rgba(140, 74, 50, 0.12)"
              iconColor="#8C4A32"
              onClick={() => onNavigate('projects')}
            />
          </div>
        </div>

        {/* Group 2: Statements & Reports */}
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: 'var(--color-text-muted)',
            marginBottom: '8px',
            paddingLeft: '6px',
          }}>
            Finance & Reports
          </div>

          <div style={{
            background: 'var(--color-surface-2, #FFFFFF)',
            borderRadius: '16px',
            border: '1px solid rgba(217, 211, 197, 0.7)',
            boxShadow: '0 2px 8px rgba(59,42,31,0.03)',
            overflow: 'hidden',
          }}>
            <MenuRow
              title="Client Outstanding Statement"
              subtitle="Download consolidated receivables statement PDF"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              }
              iconBg="rgba(200, 169, 106, 0.2)"
              iconColor="#8C6527"
              onClick={() => setShowStatementModal(true)}
            />
          </div>
        </div>

        {/* Group 3: Configuration */}
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: 'var(--color-text-muted)',
            marginBottom: '8px',
            paddingLeft: '6px',
          }}>
            Configuration
          </div>

          <div style={{
            background: 'var(--color-surface-2, #FFFFFF)',
            borderRadius: '16px',
            border: '1px solid rgba(217, 211, 197, 0.7)',
            boxShadow: '0 2px 8px rgba(59,42,31,0.03)',
            overflow: 'hidden',
          }}>
            <MenuRow
              title="Settings & GST Setup"
              subtitle="Company profile, bank details, SAC codes & terms"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              }
              iconBg="rgba(90, 122, 46, 0.12)"
              iconColor="#5A7A2E"
              onClick={() => onNavigate('settings')}
            />
          </div>
        </div>

        {/* Group 4: Account & Security */}
        <div>
          <div style={{
            background: 'var(--color-surface-2, #FFFFFF)',
            borderRadius: '16px',
            border: '1px solid rgba(217, 211, 197, 0.7)',
            boxShadow: '0 2px 8px rgba(59,42,31,0.03)',
            overflow: 'hidden',
          }}>
            <MenuRow
              title={signingOut ? "Signing Out…" : "Sign Out"}
              subtitle="Log out of SVC Billing session"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              }
              iconBg="rgba(139, 46, 46, 0.1)"
              iconColor="var(--color-error)"
              isDanger
              onClick={handleSignOut}
            />
          </div>
        </div>

        {/* Footer info */}
        <div style={{
          textAlign: 'center',
          padding: '16px 0 8px',
          color: 'var(--color-text-faint)',
          fontSize: '11px',
          letterSpacing: '0.2px',
        }}>
          SVC Billing • iOS PWA Edition
        </div>

      </div>

      {/* Statement Modal */}
      {showStatementModal && (
        <ErrorBoundary fallbackTitle="Statement Report Error" onClose={() => setShowStatementModal(false)}>
          <OutstandingStatementModal onClose={() => setShowStatementModal(false)} />
        </ErrorBoundary>
      )}
    </div>
  )
}
