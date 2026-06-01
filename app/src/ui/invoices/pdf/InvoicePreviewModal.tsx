/**
 * InvoicePreviewModal.tsx
 * Full-screen modal showing the react-pdf preview for an invoice.
 * Offers Download and Share (Web Share API) actions.
 * Triggers PDF upload to Supabase Storage on first open (lazy, once per invoice).
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

type Stage = 'loading' | 'ready' | 'error';

export function InvoicePreviewModal({ invoiceId, invoiceNumber, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('loading');
  const [payload, setPayload] = useState<InvoicePdfProps | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

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

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

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
          background: 'var(--color-primary)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
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
            <PDFDownloadLink
              document={<InvoicePdf {...payload} />}
              fileName={`${invoiceNumber.replace(/\//g, '_')}.pdf`}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
                padding: '6px 14px',
                textDecoration: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {({ loading }) => (loading ? 'Preparing…' : '⬇ Download')}
            </PDFDownloadLink>
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
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
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
          isDesktop ? (
            <PDFViewer width="100%" height="100%" style={{ border: 'none' }}>
              <InvoicePdf {...payload} />
            </PDFViewer>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 16,
                padding: 24,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 48 }}>📄</div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Invoice Ready</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                Use the Download or Share buttons above to save or send this invoice.
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
