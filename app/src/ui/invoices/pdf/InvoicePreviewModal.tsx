/**
 * InvoicePreviewModal.tsx
 * Full-screen modal showing the invoice PDF.
 *
 * iOS FIX: replaces <iframe src="blob:..."> with pdfjs-dist canvas rendering.
 * iOS Safari cannot render PDFs inside iframes — it opens them externally.
 * pdfjs renders each page to a <canvas> element, which works natively on iOS.
 *
 * Keeps: Download, Share (Web Share API), upload to Supabase Storage.
 * Does NOT change: buildInvoicePayload, InvoicePdf, uploadInvoicePdf (business logic).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { pdf } from '@react-pdf/renderer';
import * as PDFJS from 'pdfjs-dist';
import { InvoicePdf } from './InvoicePdf';
import { buildInvoicePayload } from './buildInvoicePayload';
import { uploadInvoicePdf } from '../../../db/invoicePdfDb';
import type { InvoicePdfProps } from './invoicePayloadTypes';
import { X, Download, Share2 } from 'lucide-react';

// Point pdfjs-dist worker at the bundled worker (Vite handles this)
PDFJS.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  invoiceId: number;
  invoiceNumber: string;
  onClose: () => void;
}

type Stage = 'loading-data' | 'rendering-pdf' | 'rendering-pages' | 'ready' | 'error';

// ─── Component ───────────────────────────────────────────────────────────────

export function InvoicePreviewModal({ invoiceId, invoiceNumber, onClose }: Props) {
  const [stage,     setStage]     = useState<Stage>('loading-data');
  const [payload,   setPayload]   = useState<InvoicePdfProps | null>(null);
  const [errorMsg,  setErrorMsg]  = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded,  setUploaded]  = useState(false);
  const [pdfBlob,   setPdfBlob]   = useState<Blob | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const scrollRef    = useRef<HTMLDivElement>(null);
  const canvasRefs   = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderTasksRef = useRef<PDFJS.RenderTask[]>([]);

  // ── Step 1: Load invoice data ─────────────────────────────────────────────
  useEffect(() => {
    buildInvoicePayload(invoiceId)
      .then(p => {
        setPayload(p);
        setStage('rendering-pdf');
      })
      .catch(e => {
        setErrorMsg(e?.message ?? 'Failed to load invoice data.');
        setStage('error');
      });
  }, [invoiceId]);

  // ── Step 2: Render PDF → Blob ─────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'rendering-pdf' || !payload) return;
    let active = true;

    pdf(<InvoicePdf {...payload} />)
      .toBlob()
      .then(blob => {
        if (!active) return;
        setPdfBlob(blob);
        setStage('rendering-pages');

        // Upload to storage (non-blocking, runs in background)
        if (!uploaded && !uploading) {
          setUploading(true);
          uploadInvoicePdf(invoiceId, invoiceNumber, blob)
            .then(() => setUploaded(true))
            .catch(e => console.warn('PDF upload failed (non-blocking):', e.message))
            .finally(() => setUploading(false));
        }
      })
      .catch(e => {
        if (!active) return;
        setErrorMsg(e?.message ?? 'Failed to render PDF.');
        setStage('error');
      });

    return () => { active = false; };
  }, [stage, payload, invoiceId, invoiceNumber, uploaded, uploading]);

  // ── Step 3: Render pages to canvas via pdfjs ──────────────────────────────
  useEffect(() => {
    if (stage !== 'rendering-pages' || !pdfBlob) return;
    let active = true;

    (async () => {
      try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const loadingTask = PDFJS.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;

        if (!active) return;
        setPageCount(pdfDoc.numPages);
        setStage('ready');

        // Render each page after state update (canvas elements will be ready)
        requestAnimationFrame(async () => {
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            if (!active) break;
            const page = await pdfDoc.getPage(i);
            const canvas = canvasRefs.current[i - 1];
            if (!canvas) continue;

            const viewport = page.getViewport({ scale: 1.5 });
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            canvas.width  = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width  = '100%';
            canvas.style.height = 'auto';

            const task = page.render({ canvasContext: ctx, viewport });
            renderTasksRef.current.push(task);
            await task.promise;
          }
        });
      } catch (e: any) {
        if (!active) return;
        setErrorMsg(e?.message ?? 'Failed to render PDF pages.');
        setStage('error');
      }
    })();

    return () => {
      active = false;
      renderTasksRef.current.forEach(t => t.cancel());
      renderTasksRef.current = [];
    };
  }, [stage, pdfBlob]);

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${invoiceNumber.replace(/\//g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pdfBlob, invoiceNumber]);

  // ── Share (Web Share API — native iOS share sheet) ───────────────────────
  const handleShare = useCallback(async () => {
    if (!pdfBlob) return;
    const file = new File([pdfBlob], `${invoiceNumber.replace(/\//g, '_')}.pdf`, {
      type: 'application/pdf',
    });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${invoiceNumber}` });
      } else {
        handleDownload();
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('Share failed:', e);
    }
  }, [pdfBlob, invoiceNumber, handleDownload]);

  const isLoading = stage === 'loading-data' || stage === 'rendering-pdf' || stage === 'rendering-pages';
  const isReady   = stage === 'ready';

  // ── Render ────────────────────────────────────────────────────────────────
  return createPortal(
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          300,
        background:      'rgba(20, 14, 8, 0.72)',
        display:         'flex',
        flexDirection:   'column',
      }}
    >
      {/* ── Header bar ── */}
      <div
        style={{
          background:      'var(--topbar-bg)',
          padding:         `calc(12px + var(--safe-top)) calc(16px + var(--safe-right)) 12px calc(16px + var(--safe-left))`,
          display:         'flex',
          alignItems:      'center',
          gap:             12,
          flexShrink:      0,
          borderBottom:    '1px solid rgba(200, 169, 106, 0.18)',
          backdropFilter:  'blur(12px)',
        }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          style={{
            background:     'rgba(255,255,255,0.12)',
            border:         'none',
            borderRadius:   '10px',
            color:          '#fff',
            width:          '36px',
            height:         '36px',
            minHeight:      '36px',
            minWidth:       '36px',
            cursor:         'pointer',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div style={{ flex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', fontWeight: 500 }}>
            Invoice Preview
          </div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.2px' }}>
            {invoiceNumber}
          </div>
        </div>

        {/* Uploading badge */}
        {uploading && (
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px' }}>
            Saving…
          </span>
        )}

        {/* Actions */}
        {isReady && pdfBlob && (
          <>
            <button
              type="button"
              onClick={handleDownload}
              aria-label="Download PDF"
              style={{
                background:  'rgba(255,255,255,0.12)',
                border:      '1px solid rgba(255,255,255,0.2)',
                borderRadius:'10px',
                color:       '#fff',
                fontSize:    '13px',
                fontWeight:  500,
                padding:     '8px 14px',
                cursor:      'pointer',
                display:     'flex',
                alignItems:  'center',
                gap:         '6px',
                minHeight:   '36px',
              }}
            >
              <Download size={15} />
              Download
            </button>

            <button
              type="button"
              onClick={handleShare}
              aria-label="Share PDF"
              style={{
                background:  'var(--color-accent)',
                border:      'none',
                borderRadius:'10px',
                color:       'var(--color-primary)',
                fontSize:    '13px',
                fontWeight:  600,
                padding:     '8px 14px',
                cursor:      'pointer',
                display:     'flex',
                alignItems:  'center',
                gap:         '6px',
                minHeight:   '36px',
              }}
            >
              <Share2 size={15} />
              Share
            </button>
          </>
        )}
      </div>

      {/* ── Content area ── */}
      <div
        ref={scrollRef}
        style={{
          flex:                    1,
          overflowY:               'auto',
          overflowX:               'hidden',
          WebkitOverflowScrolling: 'touch' as any,
          padding:                 '16px 0',
          paddingBottom:           `calc(16px + var(--safe-bottom))`,
          background:              '#3a3530',
          display:                 'flex',
          flexDirection:           'column',
          alignItems:              'center',
          gap:                     '12px',
        }}
      >
        {/* Loading state */}
        {isLoading && (
          <div
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '16px',
              minHeight:      '60vh',
            }}
          >
            <LoadingSpinner />
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: 0 }}>
              {stage === 'loading-data'     ? 'Loading invoice data…'   :
               stage === 'rendering-pdf'   ? 'Generating PDF…'         :
                                             'Rendering preview…'}
            </p>
          </div>
        )}

        {/* Error state */}
        {stage === 'error' && (
          <div
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '12px',
              minHeight:      '60vh',
            }}
          >
            <span style={{ fontSize: '36px' }}>⚠️</span>
            <p style={{ color: '#ff9a9a', fontSize: '14px', textAlign: 'center', padding: '0 24px', margin: 0 }}>
              {errorMsg}
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                background:   'rgba(255,255,255,0.12)',
                border:       '1px solid rgba(255,255,255,0.2)',
                borderRadius: '10px',
                color:        '#fff',
                padding:      '10px 20px',
                fontSize:     '14px',
                cursor:       'pointer',
              }}
            >
              Close
            </button>
          </div>
        )}

        {/* Canvas pages */}
        {isReady && Array.from({ length: pageCount }, (_, i) => (
          <div
            key={i}
            style={{
              background:   '#fff',
              borderRadius: '4px',
              boxShadow:    '0 4px 20px rgba(0,0,0,0.4)',
              overflow:     'hidden',
              width:        '100%',
              maxWidth:     '600px',
            }}
          >
            <canvas
              ref={el => { canvasRefs.current[i] = el; }}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div
      style={{
        width:        '40px',
        height:       '40px',
        border:       '3px solid rgba(255,255,255,0.15)',
        borderTop:    '3px solid rgba(200, 169, 106, 0.9)',
        borderRadius: '50%',
        animation:    'spin 0.9s linear infinite',
      }}
    />
  );
}

// inject spin keyframe once
if (typeof document !== 'undefined') {
  const id = '__svc-spinner';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
}
