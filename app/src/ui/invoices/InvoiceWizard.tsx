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
  // The DB id of the invoice row when editing an existing draft.
  // Must be provided when opening any previously-saved draft so that
  // saveDraft and finalizeInvoice UPDATE the same row rather than
  // inserting a new one.
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

  // FIX (rental TDS bug): setRentalItems alone only updates draft.rental_items.
  // It never triggers recomputeTotals, so total_taxable / tds_amount / net_receivable
  // stay 0 for the entire rental wizard flow. The Section4Review useEffect guard
  // (updated.total_taxable !== draft.total_taxable) then evaluates 0 !== 0 = false
  // and patch never fires — PDF preview receives tds_amount=0 and wrong totals.
  //
  // Fix: wrap setRentalItems so totals are recomputed immediately after each change,
  // matching how the quantity path works (setLineItems already sets taxable_value
  // per item so total_taxable is non-zero before Section4 mounts).
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
