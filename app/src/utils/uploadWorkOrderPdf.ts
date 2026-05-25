// uploadWorkOrderPdf.ts
// Uploads a PDF file to the Supabase Storage `work-orders` bucket.
// Returns the public URL of the uploaded file.
// Called AFTER the user confirms the parsed data and the WO row is saved.

import { supabase } from '../db/supabaseClient'

export async function uploadWorkOrderPdf(file: File, workOrderId: number): Promise<string> {
  const ext      = file.name.split('.').pop() ?? 'pdf'
  const fileName = `wo_${workOrderId}_${Date.now()}.${ext}`
  const path     = `work-orders/${fileName}`

  const { error } = await supabase.storage
    .from('work-orders')
    .upload(path, file, { contentType: 'application/pdf', upsert: false })

  if (error) throw new Error(`PDF upload failed: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage
    .from('work-orders')
    .getPublicUrl(path)

  return publicUrl
}
