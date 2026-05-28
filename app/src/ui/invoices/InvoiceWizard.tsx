// Main Invoice Wizard — orchestrates all 4 sections
import React from 'react'
import type { InvoiceDraft, InvoiceStatus } from '../../db/types'
import { useInvoiceDraft } from './useInvoiceDraft'
import WizardNav from './WizardNav'
import Section1Header from './Section1Header'
import Section2Items from './Section2Items'
import Section3Description from './Section3Description'
import Section4Review from './Section4Review'
import { recomputeTotals } from './useInvoiceDraft'

export default function InvoiceWizard({
  initialDraft,
  existingStatus,
  onComplete,
  onSaveDraft,
}: {
  initialDraft?: InvoiceDraft
  existingStatus?: InvoiceStatus
  onComplete: () => void
  onSaveDraft?: () => void
}) {
  const {
    draft, patch, patchLineItem,
    setLineItems, setVehicles,
    setRentalItems, setItemDistribution,
    activeSection, goToSection, visitedSections,
    saving, saveDraft,
  } = useInvoiceDraft(initialDraft)

  function handleSaveDraft() {
    const updated = recomputeTotals(draft, draft.gst_rate, draft.tds_rate)
    patch(updated)
    saveDraft()
    onSaveDraft?.()
  }

  function advanceSection() {
    if (activeSection < 4) goToSection((activeSection + 1) as 2 | 3 | 4)
  }

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
            setRentalItems={setRentalItems}
            setItemDistribution={setItemDistribution}
          />
        )}
        {activeSection === 3 && (
          // For rental invoices, vehicles list is not used — Section3 skips the vehicle panel.
          // Pass setVehicles regardless; Section3 reads draft.line_item_billing_type internally.
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
          />
        )}
      </div>

      {activeSection < 4 && existingStatus !== 'final' && (
        <div style={{
          position: 'sticky', bottom: 64, left: 0, right: 0,
          padding: '10px 16px',
          background: 'var(--color-bg)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: 10, zIndex: 30,
        }}>
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
