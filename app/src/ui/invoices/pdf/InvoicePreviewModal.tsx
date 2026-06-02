/**
 * InvoicePreviewModal.tsx
 * Full-screen modal showing the react-pdf preview for an invoice.
 * Offers Download and Share (Web Share API) actions.
 * Triggers PDF upload to Supabase Storage on first open (lazy, once per invoice).
 */
import { useEffect, useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
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

export function InvoicePreviewModal({ invoiceId, invoiceNumber, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('loading');
  const [payload, setPayload] = useState<InvoicePdfProps | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  useEffect(() => {
    buildInvoicePayload(invoiceId)
      .then((p) => {
        setPayload(p);
        setStage('ready');
      })
      .catch((e) => {
        setErrorMsg(e.message ?? 'Failed to load invoice data.');
        setStage('error');
      });
  }, [invoiceId]);

  // Upload once after payload is ready
  useEffect(() => {
    if (stage !== 'ready' || !payload || uploaded || uploading) return;
    setUploading(true);
    pdf(<InvoicePdf {...payload} />)
      .toBlob()
      .then((blob) => uploadInvoicePdf(invoiceId, invoiceNumber, blob))
      .then(() => setUploaded(true))
      .catch((e) => console.warn('PDF upload failed (non-blocking):', e.message))
      .finally(() => setUploading(false));
  }, [stage, payload, uploaded, uploading, invoiceId, invoiceNumber]);

  useEffect(() => {
    if (stage !== 'ready' || !payload) return;
    let isActive = true;
    setViewerLoading(true);
    pdf(<InvoicePdf {...payload} />)
      .toBlob()
      .then((blob) => {
        if (!isActive) return;
        const url = URL.createObjectURL(blob);
        setViewerUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch((e) => {
        if (!isActive) return;
        setErrorMsg(e?.message ?? 'Failed to render PDF preview.');
        setStage('error');
      })
      .finally(() => {
        if (isActive) setViewerLoading(false);
      });
    return () => { isActive = false; };
  }, [stage, payload]);

  useEffect(() => {
    return () => {
      if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    };
  }, [viewerUrl]);

  const handleShare = useCallback(async () => {
    if (!payload) return;
    try {
      const blob = await pdf(<InvoicePdf {...payload} />).toBlob();
      const file = new File([blob], `${invoiceNumber.replace(/\//g, '_')}.pdf`, {
        type: 'application/pdf',
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${invoiceNumber}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('Share failed:', e);
    }
  }, [payload, invoiceNumber]);

  const handleDownload = useCallback(() => {
    if (!viewerUrl) return;
    const a = document.createElement('a');
    a.href = viewerUrl;
    a.download = `${invoiceNumber.replace(/\//g, '_')}.pdf`;
    a.click();
  }, [viewerUrl, invoiceNumber]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(20,14,8,0.7)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          background: 'var(--topbar-bg)',
          padding: 'calc(12px + var(--safe-top)) calc(16px + var(--safe-right)) 12px calc(16px + var(--safe-left))',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
          borderBottom: '1px solid rgba(200,169,106,0.18)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 20,
            width: 36,
            height: 36,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close preview"
        >
          ✕
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Invoice Preview</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{invoiceNumber}</div>
        </div>
        {uploading && (
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Saving…</span>
        )}
        {stage === 'ready' && payload && (
          <>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!viewerUrl}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              {viewerUrl ? '⬇ Download' : 'Preparing…'}
            </button>
            <button
              type="button"
              onClick={handleShare}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              ↑ Share
            </button>
          </>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', paddingBottom: 'var(--safe-bottom)' }}>
        {stage === 'loading' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#fff',
              fontSize: 14,
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 28 }}>⏳</div>
            <div>Loading invoice data…</div>
          </div>
        )}

        {stage === 'error' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#ff8585',
              fontSize: 14,
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 28 }}>⚠️</div>
            <div>{errorMsg}</div>
          </div>
        )}

        {stage === 'ready' && payload && (
          viewerLoading || !viewerUrl ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#fff',
                fontSize: 14,
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 28 }}>⏳</div>
              <div>Rendering PDF preview…</div>
            </div>
          ) : (
            <iframe title="Invoice PDF" src={viewerUrl} style={{ width: '100%', height: '100%', border: 'none', background: 'var(--color-bg)' }} />
          )
        )}
      </div>
    </div>
  );
}
