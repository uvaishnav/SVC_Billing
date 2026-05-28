// Top navigation bar for the invoice wizard.
// Shows 4 section icons with tick/red indicators.
import React from 'react'
import type { WizardSection } from './useInvoiceDraft'
import { isSectionComplete } from './useInvoiceDraft'
import type { InvoiceDraft } from '../../db/types'

const SECTIONS: { id: WizardSection; label: string; icon: string }[] = [
  { id: 1, label: 'Header',  icon: '📋' },
  { id: 2, label: 'Items',   icon: '📦' },
  { id: 3, label: 'Desc',    icon: '✍️' },
  { id: 4, label: 'Review',  icon: '✅' },
]

export default function WizardNav({
  draft,
  activeSection,
  visitedSections,
  onSelect,
}: {
  draft: InvoiceDraft
  activeSection: WizardSection
  visitedSections: Set<WizardSection>
  onSelect: (s: WizardSection) => void
}) {
  return (
    <div style={{
      display: 'flex',
      background: 'var(--color-surface)',
      borderBottom: '1.5px solid var(--color-border)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      {SECTIONS.map(sec => {
        const isActive   = activeSection === sec.id
        const isVisited  = visitedSections.has(sec.id)
        const isComplete = isSectionComplete(draft, sec.id)
        const canNav     = isVisited || sec.id === 1

        let indicatorColor = 'transparent'
        if (isVisited) indicatorColor = isComplete ? 'var(--color-success)' : 'var(--color-error)'

        return (
          <button
            key={sec.id}
            type="button"
            disabled={!canNav}
            onClick={() => canNav && onSelect(sec.id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '3px',
              padding: '10px 4px',
              border: 'none',
              background: isActive ? 'var(--color-surface-offset)' : 'transparent',
              cursor: canNav ? 'pointer' : 'default',
              position: 'relative',
              borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{sec.icon}</span>
            <span style={{
              fontSize: '10px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-accent)' : canNav ? 'var(--color-text-muted)' : 'var(--color-text-faint)',
              letterSpacing: '0.3px',
            }}>
              {sec.label}
            </span>
            {isVisited && (
              <span style={{
                position: 'absolute', top: '6px', right: '10px',
                fontSize: '9px',
                color: indicatorColor,
                fontWeight: 700,
              }}>
                {isComplete ? '✓' : '!'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
