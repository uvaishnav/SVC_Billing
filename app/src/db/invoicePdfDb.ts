/**
 * invoicePdfDb.ts
 * Handles PDF upload to Supabase Storage (PRIVATE bucket) and path storage on the invoice row.
 *
 * Design: mirrors the work-orders bucket pattern.
 * - Stores the STORAGE PATH (not a public URL) in invoices.pdf_url
 * - Use getInvoiceDownloadUrl() to generate a short-lived signed URL on demand
 * - Never expose a permanent public link — invoices contain sensitive financial data
 */
import { supabase } from './supabaseClient';

/**
 * Upload a generated PDF blob to the private `invoices` bucket.
 * Path: {invoice_id}/{sanitized_invoice_number}.pdf
 * Returns the storage PATH — stored in invoices.pdf_url (never a public URL).
 */
export async function uploadInvoicePdf(
  invoiceId: number,
  invoiceNumber: string,
  pdfBlob: Blob
): Promise<string> {
  const sanitized = invoiceNumber.replace(/\//g, '_');
  const path = `${invoiceId}/${sanitized}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(path, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

  // Store the PATH only — never a public URL (bucket is private)
  const { error: updateError } = await supabase
    .from('invoices')
    .update({ pdf_url: path })
    .eq('id', invoiceId);

  if (updateError) throw new Error(`Failed to save PDF path: ${updateError.message}`);

  return path;
}

/**
 * Generate a 1-hour signed URL for downloading/viewing an invoice PDF.
 * Call on-demand (e.g. when user taps "View PDF") — never store the result.
 * @param storagePath  The path stored in invoices.pdf_url  e.g. "42/SVC_2526_001.pdf"
 */
export async function getInvoiceDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('invoices')
    .createSignedUrl(storagePath, 60 * 60); // 1 hour expiry

  if (error || !data?.signedUrl)
    throw new Error(`Could not generate invoice download link: ${error?.message}`);

  return data.signedUrl;
}
