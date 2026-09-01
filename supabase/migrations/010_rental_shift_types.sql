-- ── 010_rental_shift_types.sql ──────────────────────────────────
-- Adds shift column to invoice_rental_items to support:
-- 'day' (default), 'night', and 'day_night' shift billing.

ALTER TABLE invoice_rental_items 
ADD COLUMN IF NOT EXISTS shift TEXT NOT NULL DEFAULT 'day' 
CHECK (shift IN ('day', 'night', 'day_night'));

-- Backfill existing rows based on day_night_shift boolean
UPDATE invoice_rental_items 
SET shift = CASE WHEN day_night_shift = true THEN 'day_night' ELSE 'day' END
WHERE shift IS NULL OR shift = 'day';

COMMENT ON COLUMN invoice_rental_items.shift IS
  'Shift worked by rental vehicle: day (default, 1.0x), night (1.0x), or day_night (multiplied rate).';
