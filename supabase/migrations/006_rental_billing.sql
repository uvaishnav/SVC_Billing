-- ============================================================
-- Migration 006: Rental Billing Schema
-- Run in Supabase SQL Editor after 005_projects_and_work_orders.sql
-- ============================================================
-- Changes:
--   1. sac_codes          → add applicable_billing_type column
--   2. invoices           → add line_item_billing_type column
--   3. CREATE invoice_rental_items
--   4. CREATE invoice_item_distribution
-- ============================================================

-- ------------------------------------------------------------
-- 1. sac_codes — tag each SAC code with its valid billing type
-- ------------------------------------------------------------
-- 'quantity' → only shown for quantity-based invoices
-- 'rental'   → only shown for rental-based invoices
-- 'both'     → shown for all invoice types (default)
--
-- DEFAULT 'both' ensures existing seeded rows are unaffected
-- and continue to appear in all dropdowns until the user
-- explicitly restricts them via the Settings UI.
-- ------------------------------------------------------------

ALTER TABLE sac_codes
  ADD COLUMN IF NOT EXISTS applicable_billing_type TEXT NOT NULL DEFAULT 'both'
    CONSTRAINT sac_codes_billing_type_check
      CHECK (applicable_billing_type IN ('quantity', 'rental', 'both'));

COMMENT ON COLUMN sac_codes.applicable_billing_type IS
  'Controls which invoice billing type this SAC code is valid for. ''both'' = shown in all invoices.';


-- ------------------------------------------------------------
-- 2. invoices — record the billing type at invoice level
-- ------------------------------------------------------------
-- 'quantity' → line items come from work order (unit × qty)
-- 'rental'   → line items come from invoice_rental_items (monthly/partial-day rate)
--
-- This column drives:
--   a) Which Section 2 UI is shown in the invoice wizard
--   b) Which PDF layout path the renderer takes in Part 3
--   c) Future reporting queries (e.g. all rental invoices this FY)
--
-- DEFAULT 'quantity' preserves all existing draft/final invoices.
-- ------------------------------------------------------------

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS line_item_billing_type TEXT NOT NULL DEFAULT 'quantity'
    CONSTRAINT invoices_billing_type_check
      CHECK (line_item_billing_type IN ('quantity', 'rental'));

COMMENT ON COLUMN invoices.line_item_billing_type IS
  'Invoice-level billing type. quantity = unit×qty from WO items. rental = rate×duration from invoice_rental_items.';


-- ------------------------------------------------------------
-- 3. invoice_rental_items
-- ------------------------------------------------------------
-- One row per vehicle rented in this invoice.
-- billing_mode:
--   'full_month'    → subtotal = monthly_rent
--   'partial_days'  → subtotal = (monthly_rent / 30) × num_days
-- monthly_rent is copied from vehicles.default_monthly_rent at
-- wizard open time and stored here so historical invoices are
-- not affected if the vehicle's rent rate changes later.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoice_rental_items (
  id                 BIGSERIAL PRIMARY KEY,
  invoice_id         BIGINT NOT NULL
                       REFERENCES invoices(id) ON DELETE CASCADE,
  vehicle_id         BIGINT
                       REFERENCES vehicles(id) ON DELETE SET NULL,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  billing_mode       TEXT NOT NULL DEFAULT 'full_month'
                       CONSTRAINT iri_billing_mode_check
                         CHECK (billing_mode IN ('full_month', 'partial_days')),
  num_days           INTEGER,         -- NULL when billing_mode = 'full_month'
  monthly_rent       NUMERIC NOT NULL, -- snapshot from vehicles.default_monthly_rent
  subtotal           NUMERIC NOT NULL, -- computed: full = monthly_rent; partial = (monthly_rent/30)*num_days
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: num_days must be set (and positive) when billing_mode = 'partial_days'
ALTER TABLE invoice_rental_items
  ADD CONSTRAINT iri_partial_days_requires_num_days
    CHECK (
      billing_mode = 'full_month'
      OR (billing_mode = 'partial_days' AND num_days IS NOT NULL AND num_days > 0)
    );

COMMENT ON TABLE invoice_rental_items IS
  'Vehicle rental line items for rental-type invoices. One row per vehicle per invoice.';
COMMENT ON COLUMN invoice_rental_items.monthly_rent IS
  'Snapshot of the rate at invoice creation time. Not a live FK to vehicles.default_monthly_rent.';
COMMENT ON COLUMN invoice_rental_items.subtotal IS
  'Computed by UI: full_month = monthly_rent; partial_days = (monthly_rent/30)*num_days.';

-- RLS
ALTER TABLE invoice_rental_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users manage invoice_rental_items"
  ON invoice_rental_items
  FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_rental_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE invoice_rental_items_id_seq TO authenticated;


-- ------------------------------------------------------------
-- 4. invoice_item_distribution
-- ------------------------------------------------------------
-- Maps the rental invoice total back to individual work_order_items
-- for cumulative_billed_qty tracking and utilisation bar accuracy.
--
-- Populated after the user confirms the distribution in Section 2.
-- Default split is equal across all linked WO items; user can
-- adjust each item's allocation_pct before finalizing.
--
-- On finalize, invoicesDb.ts iterates these rows and increments
-- work_order_items.cumulative_billed_qty by (allocated_amount / rate)
-- per item — keeping the utilisation bars consistent for both
-- quantity and rental invoices.
--
-- UNIQUE(invoice_id, work_order_item_id): one distribution row
-- per WO item per invoice — prevents accidental duplicates.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoice_item_distribution (
  id                   BIGSERIAL PRIMARY KEY,
  invoice_id           BIGINT NOT NULL
                         REFERENCES invoices(id) ON DELETE CASCADE,
  work_order_item_id   BIGINT NOT NULL
                         REFERENCES work_order_items(id) ON DELETE CASCADE,
  allocation_pct       NUMERIC NOT NULL
                         CONSTRAINT iid_pct_range CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  allocated_amount     NUMERIC NOT NULL
                         CONSTRAINT iid_amount_positive CHECK (allocated_amount >= 0),
  created_at           TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT iid_unique_invoice_item UNIQUE (invoice_id, work_order_item_id)
);

COMMENT ON TABLE invoice_item_distribution IS
  'Distributes rental invoice total across WO items for cumulative_billed_qty tracking. One row per WO item per invoice.';
COMMENT ON COLUMN invoice_item_distribution.allocation_pct IS
  'User-set percentage (0–100). Sum across all rows for an invoice should equal 100.';
COMMENT ON COLUMN invoice_item_distribution.allocated_amount IS
  'Derived from allocation_pct × invoice taxable total. Stored for auditability.';

-- RLS
ALTER TABLE invoice_item_distribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users manage invoice_item_distribution"
  ON invoice_item_distribution
  FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_item_distribution TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE invoice_item_distribution_id_seq TO authenticated;


-- ------------------------------------------------------------
-- Verification queries (run manually after applying migration)
-- ------------------------------------------------------------
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name IN ('sac_codes', 'invoices', 'invoice_rental_items', 'invoice_item_distribution')
--  ORDER BY table_name, ordinal_position;
