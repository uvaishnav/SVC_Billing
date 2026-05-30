import type { InvoiceDraft } from '../../../db/types'

/**
 * Generates a GST-compliant PDF for the given invoice draft.
 *
 * STUB — full implementation coming in the PDF rendering feature.
 * Returns a Blob so Section4Review can open it in a new tab via createObjectURL.
 */
export async function generatePdf(draft: InvoiceDraft): Promise<Blob> {
  // TODO: implement jsPDF layout (quantity path + rental path)
  throw new Error(
    'PDF generation is not yet implemented. ' +
    'This will be built in the PDF rendering feature session.'
  )
}
