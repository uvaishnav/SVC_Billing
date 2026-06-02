/**
 * InvoicePreviewModal.tsx
 * Full-screen invoice preview. On iOS PWA (and all mobile),
 * renders PDF pages as <canvas> via PDF.js (WKWebView-safe).
 * On desktop (≥1024px), uses @react-pdf/renderer PDFViewer.
 * Uploads to Supabase Storage on first open (unchanged).
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

type Stage = 'loading' | 'ready' | 'error';

// ─── PDF.js canvas renderer (mobile / iOS PWA) ────────────────────────────────────────────

function PdfJsViewer({ blob }: { blob: Blob }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState('');
  const renderRef = useRef(false);

  useEffect(() => {
    if (renderRef.current) return;
    renderRef.current = true;

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdfDoc = await loadingTask.promise;
        setPageCount(pdfDoc.numPages);

        if (!containerRef.current) return;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });

          const canvas = document.createElement('canvas');
          canvas.width  = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width  = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.marginBottom = pageNum < pdfDoc.numPages ? '2px' : '0';

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          await page.render({ canvasContext: ctx, viewport }).promise;

          if (containerRef.current) {
            containerRef.current.appendChild(canvas);
          }
        }
      } catch (e: any) {
        setError(e?.message ?? 'PDF render failed');
      }
    }

    render();
  }, [blob]);

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#ff8585', fontSize: 13 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
        <div>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {pageCount === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'rgba(255,255,255,0.6)', fontSize: 13, gap: 10 }}>
          <span style={{ fontSize: 20 }}>⏳</span> Rendering pages…
        </div>
      )}
      <div ref={containerRef} style={{ background: '#e5e5e5' }} />
    </div>
  );
}

// ─── Main Modal ─────────────────────────────────────────────────────────────────────────────────

export function InvoicePreviewModal({ invoiceId, invoiceNumber, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('loading');
  const [payload, setPayload] = useState<InvoicePdfProps | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  useEffect(() => {
    buildInvoicePayload(invoiceId)
      .then(p => { setPayload(p); setStage('ready'); })
      .catch(e => { setErrorMsg(e.message ?? 'Failed to load invoice data.'); setStage('error'); });
  }, [invoiceId]);

  useEffect(() => {
    if (stage !== 'ready' || !payload) return;
    pdf(<InvoicePdf {...payload} />)
      .toBlob()
      .then(blob => {
        setPdfBlob(blob);
        if (!uploaded && !uploading) {
          setUploading(true);
          uploadInvoicePdf(invoiceId, invoiceNumber, blob)
            .then(() => setUploaded(true))
            .catch(e => console.warn('PDF upload failed (non-blocking):', e.message))
            .finally(() => setUploading(false));
        }
      })
      .catch(e => console.warn('Blob gen failed:', e));
  }, [stage, payload]);

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

  const handleOpenInBrowser = useCallback(() => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, [pdfBlob]);

  return (
    <div
      className="sheet-enter"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(20,14,8,0.82)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* ─── Header bar ─── */}
      <div
        style={{
          background: 'var(--color-primary)',
          paddingTop: 'calc(14px + var(--safe-top))',
          paddingBottom: '12px',
          paddingLeft: '16px',
          paddingRight: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          boxShadow: '0 1px 0 rgba(200,169,106,0.15)',
        }}
      >
        <button
          type="button" onClick={onClose} aria-label="Close preview"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#fff', fontSize: 18, width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity 150ms' }}
        >✕</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Invoice Preview</div>
          <div style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: 15, letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {invoiceNumber}
          </div>
        </div>

        {uploading && <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Saving…</span>}

        {stage === 'ready' && pdfBlob && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleShare} aria-label="Share invoice" style={headerBtnStyle}>↑ Share</button>
            {isMobile && (
              <button type="button" onClick={handleOpenInBrowser} aria-label="Open PDF in browser" style={{ ...headerBtnStyle, background: 'rgba(200,169,106,0.2)', borderColor: 'rgba(200,169,106,0.4)', color: 'var(--color-accent)' }}>⎋ Open</button>
            )}
            {!isMobile && payload && (
              <PDFDownloadLink document={<InvoicePdf {...payload} />} fileName={`${invoiceNumber.replace(/\//g, '_')}.pdf`} style={headerBtnStyle}>
                {({ loading }) => loading ? 'Preparing…' : '⬇ Download'}
              </PDFDownloadLink>
            )}
          </div>
        )}
      </div>

      {/* ─── Content area ─── */}
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' as any, position: 'relative', paddingBottom: 'var(--safe-bottom)' }}>
        {stage === 'loading' && <CentreMessage icon="⏳" text="Loading invoice data…" />}
        {stage === 'error'   && <CentreMessage icon="⚠️" text={errorMsg} color="#ff8585" />}
        {stage === 'ready' && payload && (
          isMobile ? (
            pdfBlob ? <PdfJsViewer blob={pdfBlob} /> : <CentreMessage icon="⏳" text="Generating PDF…" />
          ) : (
            <PDFViewer width="100%" height="100%" style={{ border: 'none', display: 'block' }}>
              <InvoicePdf {...payload} />
            </PDFViewer>
          )
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────────────────

const headerBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: 12,
  fontWeight: 500,
  padding: '7px 13px',
  cursor: 'pointer',
  fontFamily: 'Work Sans, sans-serif',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  transition: 'opacity 150ms',
}

function CentreMessage({ icon, text, color = 'rgba(255,255,255,0.7)' }: { icon: string; text: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, flexDirection: 'column', gap: 12, padding: 24, color, fontSize: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div>{text}</div>
    </div>
  );
}
