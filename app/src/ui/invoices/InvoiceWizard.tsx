// Main Invoice Wizard — orchestrates all 4 sections
import React, { useRef, useEffect } from 'react'
import type { InvoiceDraft, InvoiceStatus, InvoiceRentalItemDraft, InvoiceItemDistributionDraft } from '../../db/types'
import { useInvoiceDraft, recomputeTotals } from './useInvoiceDraft'
import type { WizardSection } from './useInvoiceDraft'
import WizardNav from './WizardNav'
import Section1Header from './Section1Header'
import Section2Items from './Section2Items'
import Section3Description from './Section3Description'
import Section4Review from './Section4Review'

const SECTION_NAMES: Record<WizardSection, string> = {
  1: 'Header',
  2: 'Line Items',
  3: 'Description',
  4: 'Review & Finalize',
}

export default function InvoiceWizard({
  initialDraft,
  existingStatus,
  existingInvoiceId,
  onComplete,
  onSaveDraft,
  onCancel,
}: {
  initialDraft?: InvoiceDraft
  existingStatus?: InvoiceStatus
  existingInvoiceId?: number | null
  onComplete: () => void
  onSaveDraft?: () => void
  onCancel?: () => void
}) {
  const {
    draft, patch, patchLineItem,
    setLineItems, setVehicles,
    setRentalItems, setItemDistribution,
    activeSection, goToSection, visitedSections,
    saving, saveDraft,
    savedInvoiceId,
  } = useInvoiceDraft(initialDraft, existingInvoiceId)

  const wizardRootRef = useRef<HTMLDivElement>(null)

  // Scroll smoothly to top whenever section changes
  useEffect(() => {
    const scrollParent = wizardRootRef.current?.closest('.scroll-area')
    if (scrollParent) {
      scrollParent.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [activeSection])

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
    if (activeSection < 4) goToSection((activeSection + 1) as WizardSection)
  }

  function prevSection() {
    if (activeSection > 1) goToSection((activeSection - 1) as WizardSection)
  }

  // Whether we are editing a previously-finalised invoice.
  // When true: hide "Save Draft" (finals must not be demoted to draft),
  // but still show "Next →" so the user can navigate all sections.
  const isEditingFinal = existingStatus === 'final'

  return (
    <div ref={wizardRootRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--color-bg)' }}>
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

      {/* ─── Apple HIG Top Header & Stepper (Sticky at Top) ─── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: '0 2px 8px rgba(59,42,31,0.06)',
      }}>
        {/* Row 1: Back, Title & Top Action Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 'calc(max(var(--safe-top), 8px) + 6px)',
          paddingBottom: '8px',
          paddingLeft: '12px',
          paddingRight: '12px',
          gap: '8px',
        }}>
          {/* Back button */}
          <button
            type="button"
            onClick={onCancel}
            aria-label="Back to Invoices"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 4px',
              borderRadius: '8px',
              fontFamily: 'Work Sans, sans-serif',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Invoices</span>
          </button>

          {/* Title & Step Context */}
          <div style={{ textAlign: 'center', flex: 1, minWidth: 0, padding: '0 4px' }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--color-primary)',
              fontFamily: 'Playfair Display, Georgia, serif',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {draft.invoice_number ? `Invoice #${draft.invoice_number}` : 'New Invoice'}
            </div>
            <div style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              fontFamily: 'Work Sans, sans-serif',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              Step {activeSection} of 4 • {SECTION_NAMES[activeSection]}
            </div>
          </div>

          {/* Right spacer to balance the back button and keep title centered */}
          <div style={{ width: '68px', flexShrink: 0 }} />
        </div>

        {/* Row 2: WizardNav Stepper Tabs */}
        <WizardNav
          draft={draft}
          activeSection={activeSection}
          visitedSections={visitedSections}
          onSelect={goToSection}
        />
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1 }}>
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

        {/* In-Flow Bottom Navigation (visible on sections 1-3 only, non-sticky, safe above footer) */}
        {activeSection < 4 && (
          <div style={{ padding: '0 16px', paddingBottom: '32px' }}>
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: 'var(--color-surface)',
              borderRadius: '16px',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                {activeSection > 1 && (
                  <button
                    type="button"
                    onClick={prevSection}
                    style={{
                      flex: 1,
                      padding: '13px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text)',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontFamily: 'Work Sans, sans-serif',
                    }}
                  >
                    ← {SECTION_NAMES[(activeSection - 1) as WizardSection]}
                  </button>
                )}
                <button
                  type="button"
                  onClick={advanceSection}
                  style={{
                    flex: activeSection > 1 ? 2 : 1,
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'var(--color-accent)',
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(59,42,31,0.15)',
                    fontFamily: 'Work Sans, sans-serif',
                  }}
                >
                  <span>Next: {SECTION_NAMES[(activeSection + 1) as WizardSection]}</span>
                  <span style={{ fontSize: '16px' }}>→</span>
                </button>
              </div>

              {!isEditingFinal && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: saving ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontFamily: 'Work Sans, sans-serif',
                  }}
                >
                  <span>💾</span>
                  <span>{saving ? 'Saving Draft…' : 'Save Draft'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
