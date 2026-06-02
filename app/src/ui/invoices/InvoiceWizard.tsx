// Main Invoice Wizard — orchestrates all 4 sections
import React from 'react'
import type { InvoiceDraft, InvoiceStatus, InvoiceRentalItemDraft, InvoiceItemDistributionDraft } from '../../db/types'
import { useInvoiceDraft, recomputeTotals } from './useInvoiceDraft'
import WizardNav from './WizardNav'
import Section1Header from './Section1Header'
import Section2Items from './Section2Items'
import Section3Description from './Section3Description'
import Section4Review from './Section4Review'

export default function InvoiceWizard({
  initialDraft,
  existingStatus,
  existingInvoiceId,
  onComplete,
  onSaveDraft,
}: {
  initialDraft?: InvoiceDraft
  existingStatus?: InvoiceStatus
  existingInvoiceId?: number | null
  onComplete: () => void
  onSaveDraft?: () => void
}) {
  const {
    draft, patch, patchLineItem,
    setLineItems, setVehicles,
    setRentalItems, setItemDistribution,
    activeSection, goToSection, visitedSections,
    saving, saveDraft,
    savedInvoiceId,
  } = useInvoiceDraft(initialDraft, existingInvoiceId)

  function handleSetRentalItems(items: InvoiceRentalItemDraft[]) {
    const updatedDraft = { ...draft, rental_items: items }
    const recomputed  = recomputeTotals(updatedDraft, draft.gst_rate, draft.tds_rate)
    patch(recomputed)
  }

  function handleSetItemDistribution(dist: InvoiceItemDistributionDraft[]) {
    setItemDistribution(dist)
  }

  function handleSaveDraft() {
    const updated = recomputeTotals(draft, draft.gst_rate, draft.tds_rate)
    patch(updated)
    saveDraft()
    onSaveDraft?.()
  }

  function advanceSection() {
    if (activeSection < 4) goToSection((activeSection + 1) as 2 | 3 | 4)
  }

  // Whether we are editing a previously-finalised invoice.
  // When true: hide "Save Draft" (finals must not be demoted to draft),
  // but still show "Next →" so the user can navigate all sections.
  const isEditingFinal = existingStatus === 'final'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--color-bg)' }}>
      <WizardNav
        draft={draft}
        activeSection={activeSection}
        visitedSections={visitedSections}
        onSelect={goToSection}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeSection === 1 && (
          <Section1Header draft={draft} patch={patch} />
        )}
        {activeSection === 2 && (
          <Section2Items
            draft={draft}
            setLineItems={setLineItems}
            setRentalItems={handleSetRentalItems}
            setItemDistribution={handleSetItemDistribution}
          />
        )}
        {activeSection === 3 && (
          <Section3Description draft={draft} setVehicles={setVehicles} patch={patch} />
        )}
        {activeSection === 4 && (
          <Section4Review
            draft={draft}
            patch={patch}
            saving={saving}
            saveDraft={handleSaveDraft}
            onFinalized={() => onComplete()}
            existingStatus={existingStatus}
            existingInvoiceId={savedInvoiceId}
          />
        )}
      </div>

      {/* Bottom action bar — visible on sections 1-3 only.
          Save Draft is hidden when editing a final invoice (would demote it to draft).
          Next → is ALWAYS shown so the user can navigate through all sections. */}
      {activeSection < 4 && (
        <div style={{
          position: 'sticky', bottom: 'calc(var(--nav-height) + var(--safe-bottom))', left: 0, right: 0,
          padding: '12px calc(16px + var(--safe-right)) calc(12px + var(--safe-bottom)) calc(16px + var(--safe-left))',
          background: 'var(--color-surface-2)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: 10, zIndex: 30,
          backdropFilter: 'blur(10px)',
        }}>
          {!isEditingFinal && (
            <button
              type="button" onClick={handleSaveDraft} disabled={saving}
              style={{
                flex: 1, padding: '13px', borderRadius: 12,
                border: '1.5px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-text-muted)',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              {saving ? 'Saving…' : '💾 Save Draft'}
            </button>
          )}
          <button
            type="button" onClick={advanceSection}
            style={{
              flex: 2, padding: '13px', borderRadius: 12,
              border: 'none', background: 'var(--color-accent)',
              color: 'var(--color-primary)', fontWeight: 700, fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
