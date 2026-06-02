/**
 * InvoiceActions.tsx
 * Reusable action row shown on a finalized invoice card.
 * Renders the "View PDF" button which opens InvoicePreviewModal.
 */
import { useState } from 'react';
import { FileDown } from 'lucide-react';
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
          display:        'inline-flex',
          alignItems:     'center',
          gap:            '6px',
          background:     'var(--color-primary)',
          color:          '#fff',
          border:         'none',
          borderRadius:   'var(--radius-sm)',
          padding:        '10px 16px',
          fontSize:       '14px',
          fontWeight:     600,
          cursor:         'pointer',
          fontFamily:     'Work Sans, sans-serif',
          boxShadow:      '0 2px 8px rgba(59, 42, 31, 0.22)',
          letterSpacing:  '0.1px',
        }}
      >
        <FileDown size={15} strokeWidth={2} />
        View / Download PDF
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
