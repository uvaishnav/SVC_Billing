/**
 * InvoiceActions.tsx
 * Reusable action row shown on a finalized invoice (detail sheet or list card).
 * Renders the "View PDF" button which opens InvoicePreviewModal.
 */
import { useState } from 'react';
import { InvoicePreviewModal } from './pdf/InvoicePreviewModal';

interface Props {
  invoiceId: number;
  invoiceNumber: string;
  status: string;
}

export function InvoiceActions({ invoiceId, invoiceNumber, status }: Props) {
  const [showPreview, setShowPreview] = useState(false);

  if (status === 'draft') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPreview(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--color-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'Work Sans, sans-serif',
        }}
      >
        📄 View / Download PDF
      </button>

      {showPreview && (
        <InvoicePreviewModal
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
