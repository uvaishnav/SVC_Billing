/**
 * InvoicePreviewModal.tsx
 *
 * MOBILE / iOS PWA behaviour:
 *   1. Modal opens with a “Generating PDF…” loading screen.
 *   2. Invoice data is fetched + PDF blob is generated.
 *   3. As soon as the blob is ready — automatically open it in Safari
 *      via window.open(objectURL, '_blank').  Safari renders it natively
 *      with pinch-zoom, share sheet, AirDrop, and print — far better UX
 *      than trying to embed a PDF inside a PWA WKWebView.
 *   4. The modal calls onClose() immediately after opening Safari so the
 *      app returns to the invoice list cleanly.
 *   5. The Supabase upload still happens in the background (non-blocking).
 *
 * DESKTOP behaviour (unchanged):
 *   Full-screen modal with @react-pdf/renderer PDFViewer embedded.
 *
 * WHY auto-open instead of a button:
 *   - The previous "Open in Safari" button required two taps.
 *   - The PDF modal itself had persistent animation bugs on iOS PWA
 *     (position:fixed + translateY conflicts in WKWebView).
 *   - Auto-opening is what iOS users expect from a "View PDF" action.
 *   - The loading screen gives clear feedback while the blob generates.
 */
import { useEffect, useState, useCallback } from 'react';
import { PDFViewer, PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { InvoicePdf } from './InvoicePdf';
import { buildInvoicePayload } from './buildInvoicePayload';
import { uploadInvoicePdf } from '../../../db/invoicePdfDb';
import type { InvoicePdfProps } from './invoicePayloadTypes';

interface Props {
  invoiceId: number;
  invoiceNumber: string;
  onClose: () => void;
}

type Stage = 'loading' | 'opening' | 'desktop_ready' | 'error';

export function InvoicePreviewModal({ invoiceId, invoiceNumber, onClose }: Props) {
  const [stage, setStage]     = useState<Stage>('loading');
  const [payload, setPayload] = useState<InvoicePdfProps | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded]   = useState(false);

  // Treat anything narrower than 1024px as mobile / iOS PWA
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  // ── Step 1: fetch invoice data ──────────────────────────────────────────
  useEffect(() => {
    buildInvoicePayload(invoiceId)
      .then(p => setPayload(p))
      .catch(e => {
        setErrorMsg(e.message ?? 'Failed to load invoice data.');
        setStage('error');
      });
  }, [invoiceId]);

  // ── Step 2: generate blob once payload is ready ─────────────────────────
  useEffect(() => {
    if (!payload) return;
    pdf(<InvoicePdf {...payload} />)
      .toBlob()
      .then(blob => {
        setPdfBlob(blob);

        // Background upload (non-blocking)
        if (!uploaded && !uploading) {
          setUploading(true);
          uploadInvoicePdf(invoiceId, invoiceNumber, blob)
            .then(() => setUploaded(true))
            .catch(e => console.warn('PDF upload failed (non-blocking):', e.message))
            .finally(() => setUploading(false));
        }

        if (isMobile) {
          // ── Mobile: auto-open in Safari ──────────────────────────────
          // Must use window.open synchronously relative to user gesture context.
          // We are inside a useEffect (async after render) so iOS may block
          // window.open with popup blocker. To work around this, we set stage
          // to 'opening' which renders a button the user can tap if auto-open
          // is blocked, AND we attempt window.open immediately.
          setStage('opening');
          const url = URL.createObjectURL(blob);
          const opened = window.open(url, '_blank');
          if (opened) {
            // Auto-open succeeded — close modal after a short delay so the
            // user sees the transition rather than an abrupt disappearance.
            setTimeout(() => {
              URL.revokeObjectURL(url);
              onClose();
            }, 800);
          } else {
            // Popup was blocked — show a tap-to-open button instead.
            // Store URL on window temporarily so the button can use it.
            (window as any).__invoicePdfUrl = url;
          }
        } else {
          setStage('desktop_ready');
        }
      })
      .catch(e => {
        console.warn('Blob gen failed:', e);
        setErrorMsg('Failed to generate PDF.');
        setStage('error');
      });
  }, [payload]);

  const handleManualOpen = useCallback(() => {
    const url = (window as any).__invoicePdfUrl;
    if (!url) return;
    window.open(url, '_blank');
    setTimeout(() => {
      URL.revokeObjectURL(url);
      delete (window as any).__invoicePdfUrl;
      onClose();
    }, 400);
  }, [onClose]);

  const handleShare = useCallback(async () => {
    if (!pdfBlob) return;
    try {
      const filename = `${invoiceNumber.replace(/\//g, '_')}.pdf`;
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${invoiceNumber}` });
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('Share failed:', e);
    }
  }, [pdfBlob, invoiceNumber]);

  // ── Desktop: full-screen embedded viewer (unchanged) ────────────────────
  if (!isMobile && stage === 'desktop_ready' && payload) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(20,14,8,0.82)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          background: 'var(--color-primary)',
          paddingTop: '14px', paddingBottom: '12px',
          paddingLeft: '16px', paddingRight: '16px',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <button type="button" onClick={onClose} aria-label="Close preview"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#fff', fontSize: 18, width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >✕</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Invoice Preview</div>
            <div style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{invoiceNumber}</div>
          </div>
          {uploading && <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Saving…</span>}
          {pdfBlob && (
            <PDFDownloadLink document={<InvoicePdf {...payload} />} fileName={`${invoiceNumber.replace(/\//g, '_')}.pdf`} style={headerBtnStyle}>
              {({ loading }) => loading ? 'Preparing…' : '⬇ Download'}
            </PDFDownloadLink>
          )}
        </div>
        <PDFViewer width="100%" height="100%" style={{ border: 'none', display: 'block', flex: 1 }}>
          <InvoicePdf {...payload} />
        </PDFViewer>
      </div>
    );
  }

  // ── Mobile: loading / opening / error screen ────────────────────────────
  // This is a simple centered overlay — no animation, no bottom-sheet.
  // On mobile the PDF opens in Safari; this screen is just transitional.
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'var(--color-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: '24px',
      paddingTop: 'calc(24px + var(--safe-top))',
      paddingBottom: 'calc(24px + var(--safe-bottom))',
    }}>

      {/* Close button top-left */}
      <button
        type="button" onClick={onClose} aria-label="Cancel"
        style={{
          position: 'absolute', top: 'calc(12px + var(--safe-top))', left: 16,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 10, color: '#fff', fontSize: 16,
          width: 40, height: 40, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>

      {stage === 'loading' && (
        <>
          <div style={{ fontSize: 42 }}>⏳</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>Generating PDF…</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', maxWidth: 260 }}>This usually takes a second</div>
        </>
      )}

      {stage === 'opening' && (
        <>
          <div style={{ fontSize: 42 }}>&#128196;</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>Opening in Safari…</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', maxWidth: 260 }}>
            If it didn’t open automatically, tap below
          </div>
          {/* Fallback button if popup was blocked */}
          <button
            type="button"
            onClick={handleManualOpen}
            style={{
              marginTop: 8,
              background: 'var(--color-accent)', color: 'var(--color-primary)',
              border: 'none', borderRadius: 12, fontWeight: 700,
              fontSize: 15, padding: '14px 32px', cursor: 'pointer',
              fontFamily: 'Work Sans, sans-serif',
            }}
          >
            Open PDF ↗
          </button>
          <button
            type="button"
            onClick={handleShare}
            style={{
              background: 'rgba(255,255,255,0.1)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 12, fontWeight: 500,
              fontSize: 14, padding: '12px 28px', cursor: 'pointer',
              fontFamily: 'Work Sans, sans-serif',
            }}
          >
            ↑ Share / Save
          </button>
        </>
      )}

      {stage === 'error' && (
        <>
          <div style={{ fontSize: 42 }}>⚠️</div>
          <div style={{ color: '#ff8585', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>Could not generate PDF</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', maxWidth: 260 }}>{errorMsg}</div>
          <button type="button" onClick={onClose}
            style={{ marginTop: 8, background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, fontSize: 14, padding: '12px 28px', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}
          >Go back</button>
        </>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const headerBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '8px', color: '#fff',
  fontSize: 12, fontWeight: 500,
  padding: '7px 13px', cursor: 'pointer',
  fontFamily: 'Work Sans, sans-serif',
  whiteSpace: 'nowrap', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center',
  transition: 'opacity 150ms',
};
