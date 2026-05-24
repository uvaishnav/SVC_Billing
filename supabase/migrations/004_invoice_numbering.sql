-- Migration 004: Invoice Numbering
-- Adds last_fy column to settings and creates atomic get_next_invoice_number() RPC

-- 1. Add last_fy column to settings (nullable — populated on first invoice generation)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS last_fy TEXT;

-- 2. Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON settings TO authenticated;

-- 3. Atomic Postgres function: get_next_invoice_number()
-- Locks the settings row, detects FY change, resets if needed, increments, returns formatted number.
CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row           settings%ROWTYPE;
  v_today         DATE := CURRENT_DATE;
  v_fy_start_year INT;
  v_current_fy    TEXT;
  v_new_sequence  INT;
  v_padded_seq    TEXT;
  v_invoice_num   TEXT;
BEGIN
  -- Lock the single settings row for this transaction
  SELECT * INTO v_row FROM settings WHERE id = 1 FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settings row not found. Please complete setup first.';
  END IF;

  -- Determine current financial year
  -- FY starts April 1. If month >= 4, FY starts this year; else it started last year.
  IF EXTRACT(MONTH FROM v_today) >= 4 THEN
    v_fy_start_year := EXTRACT(YEAR FROM v_today)::INT;
  ELSE
    v_fy_start_year := EXTRACT(YEAR FROM v_today)::INT - 1;
  END IF;

  -- Format: "25-26" (last 2 digits of start year + last 2 digits of end year)
  v_current_fy := LPAD((v_fy_start_year % 100)::TEXT, 2, '0') || '-' ||
                  LPAD(((v_fy_start_year + 1) % 100)::TEXT, 2, '0');

  -- Detect FY change — reset sequence to 1 if new FY
  IF v_row.last_fy IS DISTINCT FROM v_current_fy THEN
    v_new_sequence := 1;
  ELSE
    v_new_sequence := COALESCE(v_row.current_sequence, 0) + 1;
  END IF;

  -- Zero-pad the sequence number
  v_padded_seq := LPAD(v_new_sequence::TEXT, COALESCE(v_row.sequence_padding, 3), '0');

  -- Build invoice number: PREFIX/YY-YY/SEQ  e.g. SVC/25-26/001
  v_invoice_num := COALESCE(v_row.invoice_prefix, 'SVC') || '/' ||
                   v_current_fy || '/' ||
                   v_padded_seq;

  -- Atomically write back new sequence, FY, and last invoice number
  UPDATE settings
  SET
    current_sequence    = v_new_sequence,
    last_fy             = v_current_fy,
    last_invoice_number = v_invoice_num
  WHERE id = 1;

  RETURN v_invoice_num;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_next_invoice_number() TO authenticated;
