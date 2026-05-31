-- Migration 007: Add pdf_url column to invoices + invoices bucket RLS policies
-- Run this in Supabase SQL Editor after migration 006.
--
-- BUCKET SETUP (manual step — cannot be done via SQL migration):
--   Dashboard → Storage → New Bucket
--   Name: invoices
--   Public: OFF  (private bucket — mirrors the work-orders bucket)

-- ── 1. Add pdf_url column ────────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

COMMENT ON COLUMN invoices.pdf_url IS
  'Supabase Storage PATH (not a public URL) of the generated PDF in the private invoices bucket.
   Use getInvoiceDownloadUrl(pdf_url) to obtain a short-lived signed URL on demand.';

-- ── 2. Storage RLS policies for the private invoices bucket ──────────────────
-- These match the pattern used for the work-orders bucket.
-- Authenticated users (i.e. the app owner) can upload, read, and overwrite PDFs.

-- Allow authenticated users to upload (INSERT) PDFs into the invoices bucket
CREATE POLICY "Authenticated users can upload invoice PDFs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

-- Allow authenticated users to download (SELECT) invoice PDFs via signed URL
CREATE POLICY "Authenticated users can read invoice PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

-- Allow authenticated users to overwrite (UPDATE) existing PDFs (upsert: true)
CREATE POLICY "Authenticated users can update invoice PDFs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'invoices');
