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

  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null)

  React.useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  function handleSetItemDistribution(dist: InvoiceItemDistributionDraft[]) {
    setItemDistribution(dist)
  }

  async function handleSaveDraft() {
    const updated = recomputeTotals(draft, draft.gst_rate, draft.tds_rate)
    patch(updated)
    try {
      const result = await saveDraft()
      if (result) {
        setToast({ message: `Draft saved successfully! (${result.invoice.invoice_number})`, type: 'success' })
      } else {
        setToast({ message: 'Failed to save draft.', type: 'error' })
      }
    } catch (e) {
      setToast({ message: 'An unexpected error occurred while saving.', type: 'error' })
    }
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
      {toast && (
        <>
          <style>{`
            @keyframes toast-in {
              from {
                opacity: 0;
                transform: translate(-50%, -20px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translate(-50%, 0) scale(1);
              }
            }
          `}</style>
          <div style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            padding: '14px 24px',
            borderRadius: '16px',
            background: toast.type === 'success' ? 'rgba(6, 78, 59, 0.85)' : 'rgba(153, 27, 27, 0.85)',
            color: '#ffffff',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: toast.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontFamily: 'Work Sans, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            animation: 'toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            whiteSpace: 'nowrap',
            transition: 'all 0.3s ease',
          }}>
            <span style={{ fontSize: '18px' }}>
              {toast.type === 'success' ? '✨' : '⚠️'}
            </span>
            <span>{toast.message}</span>
          </div>
        </>
      )}
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
          position: 'sticky', bottom: 64, left: 0, right: 0,
          padding: '10px 16px',
          background: 'var(--color-bg)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: 10, zIndex: 30,
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
