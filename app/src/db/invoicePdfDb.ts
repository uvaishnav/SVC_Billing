/**
 * invoicePdfDb.ts
 * Handles PDF upload to Supabase Storage and storage_url update on the invoice row.
 */
import { supabase } from './supabaseClient';

/**
 * Upload a generated PDF blob to the `invoices` bucket.
 * Path: invoices/{invoice_id}/{invoice_number}.pdf
 * Returns the public URL of the uploaded file.
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

  const { data: urlData } = supabase.storage
    .from('invoices')
    .getPublicUrl(path);

  const publicUrl = urlData.publicUrl;

  // Persist the storage URL back on the invoice row
  const { error: updateError } = await supabase
    .from('invoices')
    .update({ pdf_url: publicUrl })
    .eq('id', invoiceId);

  if (updateError) throw new Error(`Failed to save PDF url: ${updateError.message}`);

  return publicUrl;
}

/**
 * Generate a short-lived signed URL for downloading a private invoice PDF.
 * Useful if the invoices bucket is private.
 */
export async function getInvoiceDownloadUrl(
  invoiceId: number,
  invoiceNumber: string
): Promise<string> {
  const sanitized = invoiceNumber.replace(/\//g, '_');
  const path = `${invoiceId}/${sanitized}.pdf`;

  const { data, error } = await supabase.storage
    .from('invoices')
    .createSignedUrl(path, 60 * 60); // 1 hour

  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
}
