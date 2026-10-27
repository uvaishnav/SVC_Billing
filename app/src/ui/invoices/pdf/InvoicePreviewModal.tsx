/**
 * InvoicePreviewModal.tsx
 *
 * iOS PWA: receives an already-open Safari window reference (`safariWindow`
 * prop) that was opened synchronously inside the View PDF button's onClick.
 * As soon as the PDF blob is ready, redirects that window to the blob URL.
 * No intermediate screen. No extra tap. The user sees the PDF in Safari
 * immediately after the blob generates (~1-2 seconds).
 *
 * If safariWindow is null (popup was blocked or desktop), falls back to:
 *   - Mobile: shows a tap-to-open button (one tap fallback)
 *   - Desktop: full-screen embedded PDF preview
 *
 * DESKTOP: a full-screen iframe previews the same fitted blob used for download and upload.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { generateInvoicePdf } from './generateInvoicePdf';
import { buildInvoicePayload } from './buildInvoicePayload';
import { uploadInvoicePdf } from '../../../db/invoicePdfDb';
import type { InvoicePdfProps } from './invoicePayloadTypes';

interface Props {
  invoiceId: number;
  invoiceNumber: string;
  /** Already-open Safari window ref from InvoiceActions. Null on desktop or if blocked. */
  safariWindow?: Window | null;
  onClose: () => void;
}

type MobileStage = 'generating' | 'done' | 'blocked' | 'error';

export function InvoicePreviewModal({ invoiceId, invoiceNumber, safariWindow, onClose }: Props) {
  const [payload,    setPayload]   = useState<InvoicePdfProps | null>(null);
  const [pdfBlob,    setPdfBlob]   = useState<Blob | null>(null);
  const [desktopPdfUrl, setDesktopPdfUrl] = useState<string | null>(null);
  const [errorMsg,   setErrorMsg]  = useState('');
  const [uploading,  setUploading] = useState(false);
  const [uploaded,   setUploaded]  = useState(false);
  const [mobileStage, setMobileStage] = useState<MobileStage>('generating');

  const objectUrlRef = useRef<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const revokeTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      if (revokeTimerRef.current !== null) window.clearTimeout(revokeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const id = 'invoice-spinner-style';
    if (typeof document === 'undefined' || document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }, []);

  // ── Fetch invoice data ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    buildInvoicePayload(invoiceId)
      .then(p => { if (!cancelled) setPayload(p); })
      .catch(e => {
        if (cancelled) return;
        if (safariWindow && !safariWindow.closed) safariWindow.close();
        setErrorMsg(e.message ?? 'Failed to load invoice data.');
        setMobileStage('error');
      });
    return () => { cancelled = true; };
  }, [invoiceId, safariWindow]);

  // ── Generate blob once payload is ready ───────────────────────────────────
  useEffect(() => {
    if (!payload) return;
    let cancelled = false;

    generateInvoicePdf(payload)
      .then(blob => {
        if (cancelled) return;
        setPdfBlob(blob);

        if (isMobile) {
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;

          if (safariWindow && !safariWindow.closed) {
            safariWindow.location.href = url;
            setMobileStage('done');
            closeTimerRef.current = window.setTimeout(() => {
              if (mountedRef.current) onClose();
            }, 600);
            revokeTimerRef.current = window.setTimeout(() => {
              URL.revokeObjectURL(url);
            }, 30_000);
          } else {
            setMobileStage('blocked');
          }
        }
      })
      .catch(e => {
        if (cancelled) return;
        console.warn('Blob generation failed:', e);
        if (safariWindow && !safariWindow.closed) safariWindow.close();
        setErrorMsg('Failed to generate PDF.');
        setMobileStage('error');
      });
    return () => { cancelled = true; };
  }, [payload, safariWindow, onClose, isMobile]);

  // Preview and download reuse exactly the same fitted bytes that are uploaded.
  useEffect(() => {
    if (!pdfBlob || isMobile) return;
    const url = URL.createObjectURL(pdfBlob);
    setDesktopPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfBlob, isMobile]);

  useEffect(() => {
    if (!pdfBlob || uploaded || uploading) return;

    setUploading(true);
    uploadInvoicePdf(invoiceId, invoiceNumber, pdfBlob)
      .then(() => setUploaded(true))
      .catch(e => console.warn('PDF upload failed:', e.message))
      .finally(() => setUploading(false));
  }, [pdfBlob, uploaded, uploading, invoiceId, invoiceNumber]);

  const handleFallbackOpen = useCallback(() => {
    const url = objectUrlRef.current;
    if (!url) return;
    window.open(url, '_blank');
    const revokeUrl = url;
    revokeTimerRef.current = window.setTimeout(() => {
      URL.revokeObjectURL(revokeUrl);
      objectUrlRef.current = null;
      if (mountedRef.current) onClose();
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

  if (!isMobile) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,14,8,0.82)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'var(--color-primary)', paddingTop: 14, paddingBottom: 12, paddingLeft: 16, paddingRight: 16, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onClose} aria-label="Close preview"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontSize: 18, width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >✕</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Invoice Preview</div>
            <div style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{invoiceNumber}</div>
          </div>
          {uploading && <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Saving…</span>}
          {desktopPdfUrl && (
            <a href={desktopPdfUrl} download={`${invoiceNumber.replace(/\//g, '_')}.pdf`} style={desktopBtnStyle}>
              ⬇ Download
            </a>
          )}
        </div>
        {desktopPdfUrl
          ? <iframe title={`Invoice ${invoiceNumber}`} src={desktopPdfUrl} width="100%" height="100%" style={{ border: 'none', display: 'flex', flex: 1 }} />
          : <div role={errorMsg ? 'alert' : 'status'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{errorMsg || '⏳ Generating invoice PDF…'}</div>
        }
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(43,31,21,0.7)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: 32,
    }}>
      {mobileStage === 'generating' && (
        <>
          <div style={spinnerStyle} />
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Generating PDF…</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center' }}>Opening in Safari</div>
        </>
      )}

      {mobileStage === 'done' && (
        <>
          <div style={{ fontSize: 44 }}>✓</div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Opened in Safari</div>
        </>
      )}

      {mobileStage === 'blocked' && (
        <>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>PDF ready</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', maxWidth: 260 }}>
            Safari blocked the automatic open. Tap below.
          </div>
          <button type="button" onClick={handleFallbackOpen}
            style={{ background: 'var(--color-accent)', color: 'var(--color-primary)', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, padding: '14px 36px', cursor: 'pointer' }}
          >Open PDF ↗</button>
          <button type="button" onClick={handleShare}
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, fontWeight: 500, fontSize: 14, padding: '12px 28px', cursor: 'pointer' }}
          >↑ Share / Save</button>
          <button type="button" onClick={onClose}
            style={{ background: 'none', color: 'rgba(255,255,255,0.4)', border: 'none', fontSize: 13, cursor: 'pointer', marginTop: 4 }}
          >Cancel</button>
        </>
      )}

      {mobileStage === 'error' && (
        <>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ color: '#ff8585', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>Could not generate PDF</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', maxWidth: 280 }}>{errorMsg}</div>
          <button type="button" onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, fontSize: 14, padding: '12px 28px', cursor: 'pointer' }}
          >Go back</button>
        </>
      )}
    </div>
  );
}

const desktopBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8, color: '#fff',
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
