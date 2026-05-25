// uploadWorkOrderPdf.ts
// Uploads a PDF file to the PRIVATE Supabase Storage `work-orders` bucket.
// Returns the storage PATH (not a public URL) — stored in work_orders.original_pdf_url.
// Use getWorkOrderPdfSignedUrl() to generate a time-limited download link on demand.

import { supabase } from '../db/supabaseClient'

/**
 * Upload a WO PDF to private storage.
 * @returns storage path e.g. "wo_42_1748156400000.pdf"
 */
export async function uploadWorkOrderPdf(file: File, workOrderId: number): Promise<string> {
  const ext      = file.name.split('.').pop() ?? 'pdf'
  const fileName = `wo_${workOrderId}_${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('work-orders')
    .upload(fileName, file, { contentType: 'application/pdf', upsert: false })

  if (error) throw new Error(`PDF upload failed: ${error.message}`)

  // Return path only — never a public URL (bucket is private)
  return fileName
}

/**
 * Generate a 1-hour signed URL for viewing/downloading a stored WO PDF.
 * Call this on-demand (e.g. when user taps "View PDF"), never store the result.
 * @param storagePath  The path stored in work_orders.original_pdf_url
 */
export async function getWorkOrderPdfSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('work-orders')
    .createSignedUrl(storagePath, 60 * 60)  // 1 hour expiry

  if (error || !data?.signedUrl) throw new Error('Could not generate PDF download link')
  return data.signedUrl
}
