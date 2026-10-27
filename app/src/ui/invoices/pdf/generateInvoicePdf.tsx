import { pdf } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import { InvoicePdf } from './InvoicePdf';
import type { InvoicePdfProps } from './invoicePayloadTypes';
import {
  INVOICE_PAGE_WIDTH, INVOICE_PAGE_HEIGHT,
  INVOICE_MARGIN, INVOICE_BOTTOM_MARGIN,
} from './invoicePageGeometry';

/**
 * Lay out once at the original width, with unlimited height. Then fit the
 * resulting vector page onto A4. Measuring the rendered page includes actual
 * font metrics, wrapped descriptions, optional fields, and the entire footer.
 * No row-count heuristics, private renderer APIs, rasterization, or truncation.
 */
export async function generateInvoicePdf(props: InvoicePdfProps): Promise<Blob> {
  const naturalBlob = await pdf(<InvoicePdf {...props} naturalHeight />).toBlob();
  return fitInvoiceToA4(await naturalBlob.arrayBuffer());
}

export async function fitInvoiceToA4(sourceBytes: ArrayBuffer): Promise<Blob> {
  const source = await PDFDocument.load(sourceBytes);
  if (source.getPageCount() !== 1) {
    throw new Error('Invoice measurement must produce one continuous page.');
  }
  const sourcePage = source.getPage(0);
  const contentHeight = sourcePage.getHeight() - INVOICE_MARGIN - INVOICE_BOTTOM_MARGIN;
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    throw new Error('Could not measure invoice content.');
  }
  const availableHeight = INVOICE_PAGE_HEIGHT - INVOICE_MARGIN - INVOICE_BOTTOM_MARGIN;
  const scale = Math.min(1, availableHeight / contentHeight);
  const output = await PDFDocument.create();
  const embedded = await output.embedPage(sourcePage);
  const page = output.addPage([INVOICE_PAGE_WIDTH, INVOICE_PAGE_HEIGHT]);

  // PDF coordinates start at bottom-left. Keep the content's top margin fixed,
  // center it horizontally, and retain the original proportions at every scale.
  page.drawPage(embedded, {
    x: (INVOICE_PAGE_WIDTH - sourcePage.getWidth() * scale) / 2,
    y: INVOICE_PAGE_HEIGHT - INVOICE_MARGIN - (sourcePage.getHeight() - INVOICE_MARGIN) * scale,
    xScale: scale,
    yScale: scale,
  });
  output.setTitle(source.getTitle() ?? 'Tax Invoice');
  const bytes = await output.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
