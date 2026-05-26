import React from 'react'

export type SectionId = 1 | 2 | 3 | 4

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 1, label: 'Header',      icon: '📄' },
  { id: 2, label: 'Items',       icon: '📋' },
  { id: 3, label: 'Description', icon: '✨' },
  { id: 4, label: 'Review',      icon: '✅' },
]

interface WizardNavProps {
  activeSection: SectionId
  sectionsVisited: number[]
  sectionsDone: number[]
  onNavigate: (s: SectionId) => void
}

export default function WizardNav({ activeSection, sectionsVisited, sectionsDone, onNavigate }: WizardNavProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0',
      padding: '12px 16px 0',
      background: 'var(--color-primary)',
    }}>
      {SECTIONS.map((section, idx) => {
        const isActive   = activeSection === section.id
        const isDone     = sectionsDone.includes(section.id)
        const isVisited  = sectionsVisited.includes(section.id)
        const isFirst    = idx === 0
        const canNavigate = isVisited || isFirst

        return (
          <React.Fragment key={section.id}>
            {/* Connector line */}
            {idx > 0 && (
              <div style={{
                flex: 1,
                height: '2px',
                background: isDone ? 'var(--color-accent)' : 'rgba(200,169,106,0.2)',
                marginBottom: '22px',
              }} />
            )}

            <button
              onClick={() => canNavigate && onNavigate(section.id)}
              disabled={!canNavigate}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '4px',
                background: 'transparent', border: 'none',
                cursor: canNavigate ? 'pointer' : 'default',
                padding: '0 4px',
                opacity: canNavigate ? 1 : 0.4,
              }}
            >
              {/* Circle */}
              <div style={{
                width: '36px', height: '36px',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px',
                background: isActive
                  ? 'var(--color-accent)'
                  : isDone
                    ? 'rgba(200,169,106,0.2)'
                    : isVisited
                      ? 'rgba(220,80,60,0.15)'
                      : 'rgba(255,255,255,0.05)',
                border: isActive
                  ? '2px solid var(--color-accent)'
                  : isDone
                    ? '2px solid var(--color-accent)'
                    : isVisited
                      ? '2px solid #dc503c'
                      : '2px solid rgba(255,255,255,0.1)',
                position: 'relative',
              }}>
                {section.icon}
                {/* Status badge */}
                {(isDone || (isVisited && !isDone)) && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    width: '14px', height: '14px',
                    borderRadius: '50%',
                    background: isDone ? '#22c55e' : '#dc503c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', color: 'white', fontWeight: 700,
                  }}>
                    {isDone ? '✓' : '!'}
                  </span>
                )}
              </div>

              {/* Label */}
              <span style={{
                fontSize: '9px',
                fontWeight: isActive ? 700 : 400,
                color: isActive
                  ? 'var(--color-accent)'
                  : isDone
                    ? 'var(--color-text-faint)'
                    : isVisited
                      ? '#dc503c'
                      : 'var(--color-text-faint)',
                fontFamily: 'Work Sans, sans-serif',
                letterSpacing: '0.3px',
                whiteSpace: 'nowrap',
              }}>{section.label}</span>
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}
