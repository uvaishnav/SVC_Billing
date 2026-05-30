-- Migration 007: Add pdf_url column to invoices + invoices bucket RLS policies
-- Run this in Supabase SQL Editor after migration 006.

-- ── 1. Add pdf_url column ────────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

COMMENT ON COLUMN invoices.pdf_url IS
  'Supabase Storage public URL for the generated PDF, set after upload.';

-- ── 2. Storage RLS policies for invoices bucket ───────────────────────────────
-- Ensure the invoices bucket exists (created manually on 2026-05-24).
-- These policies allow authenticated users to upload and read invoice PDFs.

-- Allow authenticated users to upload (INSERT) PDFs into the invoices bucket
CREATE POLICY "Authenticated users can upload invoice PDFs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

-- Allow authenticated users to download (SELECT) their invoice PDFs
CREATE POLICY "Authenticated users can read invoice PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

-- Allow authenticated users to overwrite (UPDATE) existing PDFs (upsert:true)
CREATE POLICY "Authenticated users can update invoice PDFs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'invoices');
