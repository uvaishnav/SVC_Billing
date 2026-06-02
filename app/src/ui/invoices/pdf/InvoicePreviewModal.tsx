/**
 * InvoicePreviewModal.tsx
 *
 * iOS PWA POPUP-BLOCK PROBLEM & SOLUTION
 * ----------------------------------------
 * iOS Safari only allows window.open() inside a SYNCHRONOUS user-gesture
 * handler (onclick). Any window.open() called from useEffect, setTimeout,
 * Promise.then, or async/await is treated as a popup and silently blocked.
 *
 * SOLUTION — two-phase open:
 *   Phase 1 (synchronous, on tap):
 *     - User taps the invoice card / "View PDF" button.
 *     - The PARENT component that renders <InvoicePreviewModal> must call
 *       window.open('', '_blank') BEFORE rendering this component, storing
 *       the window reference and passing it in as the `targetWindow` prop.
 *     - OR: InvoicePreviewModal renders a visible "Open PDF" button and
 *       calls window.open('', '_blank') synchronously in its onClick.
 *       A blank tab opens immediately (user sees it flicker to blank page).
 *
 *   Phase 2 (async, when blob ready):
 *     - Once the PDF blob is generated, assign location.href on the
 *       already-open window reference to the object URL.
 *     - Safari navigates the blank tab to the PDF. No new popup, no block.
 *
 * This is the standard pattern used by file-download libraries (FileSaver.js,
 * pdf-lib examples) to work around iOS popup blockers.
 *
 * DESKTOP: unchanged — embedded PDFViewer in a full-screen modal.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
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

type MobileStage =
  | 'idle'           // waiting for user to tap Open
  | 'generating'     // window opened, blob generating
  | 'done'           // blob ready, window redirected
  | 'error';

export function InvoicePreviewModal({ invoiceId, invoiceNumber, onClose }: Props) {
  const [payload, setPayload]   = useState<InvoicePdfProps | null>(null);
  const [pdfBlob, setPdfBlob]   = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded]   = useState(false);
  const [mobileStage, setMobileStage] = useState<MobileStage>('idle');

  // Holds the already-opened Safari window reference
  const safariWindowRef = useRef<Window | null>(null);
  // Holds the object URL so we can revoke it later
  const objectUrlRef = useRef<string | null>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  // ── Fetch invoice data on mount ───────────────────────────────────
  useEffect(() => {
    buildInvoicePayload(invoiceId)
      .then(p => setPayload(p))
      .catch(e => {
        setErrorMsg(e.message ?? 'Failed to load invoice data.');
        setMobileStage('error');
      });
  }, [invoiceId]);

  // ── Generate blob once payload is ready ────────────────────────────
  // On mobile this only runs after the user taps Open (safariWindowRef is set)
  // On desktop this runs immediately and sets pdfBlob for the viewer.
  useEffect(() => {
    if (!payload) return;
    if (isMobile && mobileStage !== 'generating') return; // wait for tap

    pdf(<InvoicePdf {...payload} />)
      .toBlob()
      .then(blob => {
        setPdfBlob(blob);

        // Background upload (non-blocking, runs on both mobile and desktop)
        if (!uploaded && !uploading) {
          setUploading(true);
          uploadInvoicePdf(invoiceId, invoiceNumber, blob)
            .then(() => setUploaded(true))
            .catch(e => console.warn('PDF upload failed:', e.message))
            .finally(() => setUploading(false));
        }

        if (isMobile && safariWindowRef.current) {
          // Phase 2: redirect the already-open blank tab to the PDF
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          safariWindowRef.current.location.href = url;
          setMobileStage('done');
          // Close modal after a short delay
          setTimeout(() => onClose(), 600);
          // Revoke after enough time for Safari to load the PDF
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
        }
      })
      .catch(e => {
        console.warn('Blob gen failed:', e);
        // If Safari tab is open but we failed, close it to avoid a hung blank tab
        if (safariWindowRef.current && !safariWindowRef.current.closed) {
          safariWindowRef.current.close();
        }
        setErrorMsg('Failed to generate PDF.');
        setMobileStage('error');
      });
  }, [payload, mobileStage]);

  // ── PHASE 1: called synchronously in onClick ────────────────────────
  // This MUST be called from a direct user-gesture handler (button onClick).
  // window.open here is synchronous inside the click — iOS will NOT block it.
  const handleOpenTap = useCallback(() => {
    const win = window.open('', '_blank');
    if (!win) {
      // Extremely rare: popup settings maxed out. Fall back gracefully.
      setErrorMsg('Could not open a new tab. Please allow popups for this site in Safari settings.');
      setMobileStage('error');
      return;
    }
    // Show a friendly loading page in the blank tab while the blob generates
    win.document.write(`
      <!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Generating PDF…</title>
        <style>
          body { margin:0; display:flex; flex-direction:column; align-items:center;
                 justify-content:center; min-height:100vh; background:#3B2A1F;
                 color:#C8A96A; font-family:system-ui,sans-serif; gap:16px; }
          .spinner { width:40px; height:40px; border:3px solid rgba(200,169,106,0.2);
                     border-top-color:#C8A96A; border-radius:50%;
                     animation:spin 0.8s linear infinite; }
          @keyframes spin { to { transform:rotate(360deg); } }
          p { color:rgba(200,169,106,0.6); font-size:14px; margin:0; }
        </style>
      </head><body>
        <div class="spinner"></div>
        <div>Generating PDF…</div>
        <p>Please wait a moment</p>
      </body></html>
    `);
    win.document.close();
    safariWindowRef.current = win;
    setMobileStage('generating'); // triggers blob generation in useEffect
  }, []);

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

  // ── Desktop: full-screen embedded viewer ─────────────────────────────
  if (!isMobile) {
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
          {payload && (
            <PDFDownloadLink document={<InvoicePdf {...payload} />} fileName={`${invoiceNumber.replace(/\//g, '_')}.pdf`} style={desktopBtnStyle}>
              {({ loading }) => loading ? 'Preparing…' : '⬇ Download'}
            </PDFDownloadLink>
          )}
        </div>
        {payload
          ? <PDFViewer width="100%" height="100%" style={{ border: 'none', display: 'block', flex: 1 }}><InvoicePdf {...payload} /></PDFViewer>
          : <CentreMessage icon="⏳" text="Loading invoice data…" />
        }
      </div>
    );
  }

  // ── Mobile: pre-open prompt + loading + done + error screens ─────────
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
      {/* Close / Cancel */}
      <button type="button" onClick={onClose} aria-label="Cancel"
        style={{
          position: 'absolute', top: 'calc(12px + var(--safe-top))', left: 16,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 10, color: '#fff', fontSize: 16,
          width: 40, height: 40, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >✕</button>

      {/* idle: user must tap to open — this tap is the user gesture */}
      {mobileStage === 'idle' && (
        <>
          <div style={{ fontSize: 48 }}>&#128196;</div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 17, fontWeight: 700, textAlign: 'center' }}>
            {invoiceNumber}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', maxWidth: 260 }}>
            PDF will open in Safari with full zoom, share, and print support
          </div>
          <button
            type="button"
            onClick={handleOpenTap}
            style={{
              marginTop: 8,
              background: 'var(--color-accent)', color: 'var(--color-primary)',
              border: 'none', borderRadius: 14, fontWeight: 700,
              fontSize: 16, padding: '16px 40px', cursor: 'pointer',
              fontFamily: 'Work Sans, sans-serif',
              boxShadow: '0 4px 20px rgba(200,169,106,0.35)',
            }}
          >
            Open PDF ↗
          </button>
        </>
      )}

      {/* generating: spinner while blob is built */}
      {mobileStage === 'generating' && (
        <>
          <div style={spinnerStyle} />
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>Generating PDF…</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', maxWidth: 260 }}>Your PDF is opening in Safari</div>
        </>
      )}

      {/* done: closing message (briefly visible before onClose fires) */}
      {mobileStage === 'done' && (
        <>
          <div style={{ fontSize: 48 }}>&#10003;</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 600 }}>Opened in Safari</div>
        </>
      )}

      {/* error */}
      {mobileStage === 'error' && (
        <>
          <div style={{ fontSize: 42 }}>⚠️</div>
          <div style={{ color: '#ff8585', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>Could not generate PDF</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', maxWidth: 280 }}>{errorMsg}</div>
          <button type="button" onClick={onClose}
            style={{ marginTop: 8, background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, fontSize: 14, padding: '12px 28px', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}
          >Go back</button>
        </>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const desktopBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '8px', color: '#fff',
  fontSize: 12, fontWeight: 500,
  padding: '7px 13px', cursor: 'pointer',
  fontFamily: 'Work Sans, sans-serif',
  whiteSpace: 'nowrap', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center',
};

const spinnerStyle: React.CSSProperties = {
  width: 44, height: 44,
  border: '3px solid rgba(200,169,106,0.2)',
  borderTopColor: '#C8A96A',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

// Inject spinner keyframe once
if (typeof document !== 'undefined') {
  const id = 'invoice-spinner-style';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }
}

function CentreMessage({ icon, text, color = 'rgba(255,255,255,0.7)' }: { icon: string; text: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 12, padding: 24, color, fontSize: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div>{text}</div>
    </div>
  );
}
