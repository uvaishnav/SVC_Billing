/**
 * InvoiceActions.tsx
 * Reusable action row shown on a finalized invoice (detail sheet or list card).
 *
 * iOS PWA POPUP-BLOCK FIX
 * -----------------------
 * window.open() MUST be called synchronously inside a user-gesture handler.
 * Any async call (useEffect, Promise.then, setTimeout) is silently blocked by
 * iOS Safari as a popup — even when triggered indirectly by a tap.
 *
 * Solution: call window.open('', '_blank') HERE, directly in the button's
 * onClick. This gives us a trusted window reference immediately. We then pass
 * that reference into InvoicePreviewModal, which redirects it to the PDF blob
 * URL once the blob is ready — no intermediate screen, no extra tap.
 */
import { useState } from 'react';
import { InvoicePreviewModal } from './pdf/InvoicePreviewModal';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

interface Props {
  invoiceId: number;
  invoiceNumber: string;
  status: string;
}

export function InvoiceActions({ invoiceId, invoiceNumber, status }: Props) {
  const [showPreview, setShowPreview]       = useState(false);
  const [safariWin,   setSafariWin]         = useState<Window | null>(null);

  if (status === 'draft') return null;

  function handleViewPdf() {
    if (isMobile) {
      // Phase 1 — synchronous, inside the click handler.
      // iOS Safari grants window.open here; it would block it anywhere async.
      const win = window.open('', '_blank');
      if (win) {
        // Show a branded loading page in the blank tab immediately
        win.document.write(`<!DOCTYPE html><html><head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Generating PDF…</title>
          <style>
            *{margin:0;padding:0;box-sizing:border-box}
            body{display:flex;flex-direction:column;align-items:center;
                 justify-content:center;min-height:100vh;
                 background:#3B2A1F;color:#C8A96A;
                 font-family:system-ui,sans-serif;gap:20px;padding:24px}
            .ring{width:48px;height:48px;border:3px solid rgba(200,169,106,0.2);
                  border-top-color:#C8A96A;border-radius:50%;
                  animation:spin .8s linear infinite}
            @keyframes spin{to{transform:rotate(360deg)}}
            h2{font-size:18px;font-weight:600;text-align:center}
            p{font-size:13px;color:rgba(200,169,106,0.5);text-align:center;max-width:260px}
          </style>
        </head><body>
          <div class="ring"></div>
          <h2>Generating PDF…</h2>
          <p>Your invoice will appear here in a moment</p>
        </body></html>`);
        win.document.close();
        setSafariWin(win);
      } else {
        // Popup was blocked despite our best effort (extreme Safari settings).
        // Fall back to the modal with the manual-open button.
        setSafariWin(null);
      }
    }
    // On desktop, safariWin stays null and modal uses embedded PDFViewer
    setShowPreview(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleViewPdf}
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
          width: '100%',
          justifyContent: 'center',
        }}
      >
        📄 View / Download PDF
      </button>

      {showPreview && (
        <InvoicePreviewModal
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          safariWindow={safariWin}
          onClose={() => { setShowPreview(false); setSafariWin(null); }}
        />
      )}
    </>
  );
}
