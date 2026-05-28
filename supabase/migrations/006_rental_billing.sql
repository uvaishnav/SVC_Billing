-- ============================================================
-- Migration 006: Rental Billing Schema
-- Run in Supabase SQL Editor after 005_projects_and_work_orders.sql
-- ============================================================
-- Changes:
--   1. sac_codes                → add applicable_billing_type column
--   2. invoices                 → add line_item_billing_type column
--   3. CREATE invoice_rental_items
--   4. CREATE invoice_item_distribution
--   5. CREATE vehicle_billing_ledger
--
-- NOTE: Steps 1 and 2 (ALTER statements) have already been run.
-- Run steps 3, 4, 5 (CREATE TABLE blocks) if not yet applied.
-- All blocks use CREATE TABLE IF NOT EXISTS — safe to re-run.
-- ============================================================


-- ============================================================
-- DATA FLOW REFERENCE
-- ============================================================
--
-- QUANTITY INVOICE
-- ─────────────────────────────────────────────────────────────
-- invoice_line_items  (one row per WO item)
--   qty × rate = taxable_value per item
--   SUM(taxable_value) = invoices.total_taxable
--   cumulative_billed_qty updated per WO item on finalize
-- invoice_vehicles    (vehicle list — description/tracing only, no amounts)
-- vehicle_billing_ledger  (equal split of total_taxable across vehicles)
--
-- RENTAL INVOICE
-- ─────────────────────────────────────────────────────────────
-- invoice_rental_items  (one row per vehicle)
--   subtotal per vehicle = full_month OR (monthly_rent/30)*num_days
--   SUM(subtotal) = invoices.total_taxable
-- invoice_item_distribution  (one row per WO item)
--   user distributes total_taxable % across WO items
--   cumulative_billed_qty updated per WO item on finalize
-- vehicle_billing_ledger  (exact subtotal per vehicle from invoice_rental_items)
--
-- invoice_vehicles is NOT populated for rental invoices —
-- vehicle info is already carried in invoice_rental_items.
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
-- ✅ Already applied.
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
-- 'quantity' → line items are unit×qty WO items (invoice_line_items)
-- 'rental'   → line items are per-vehicle monthly/partial rent (invoice_rental_items)
--
-- Drives: Section 2 wizard UI, PDF layout path, dashboard filters.
-- DEFAULT 'quantity' preserves all existing draft/final invoices.
-- ✅ Already applied.
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
-- One row per vehicle per rental invoice.
-- Multiple rows = multiple vehicles — their subtotals sum to
-- invoices.total_taxable.
--
-- billing_mode:
--   'full_month'   → subtotal = monthly_rent
--   'partial_days' → subtotal = (monthly_rent / 30) × num_days
--
-- monthly_rent is snapshotted from vehicles.default_monthly_rent
-- at wizard-open time so historical invoices are unaffected by
-- future rate changes on the vehicle record.
--
-- vehicle_id ON DELETE SET NULL: if a vehicle is soft-deleted,
-- existing rental items retain their amounts (history preserved).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoice_rental_items (
  id             BIGSERIAL PRIMARY KEY,
  invoice_id     BIGINT NOT NULL
                   REFERENCES invoices(id) ON DELETE CASCADE,
  vehicle_id     BIGINT
                   REFERENCES vehicles(id) ON DELETE SET NULL,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  billing_mode   TEXT NOT NULL DEFAULT 'full_month'
                   CONSTRAINT iri_billing_mode_check
                     CHECK (billing_mode IN ('full_month', 'partial_days')),
  num_days       INTEGER,          -- NULL when billing_mode = 'full_month'
  monthly_rent   NUMERIC NOT NULL, -- snapshot from vehicles.default_monthly_rent
  subtotal       NUMERIC NOT NULL, -- computed by UI; stored for audit
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- num_days must be set and positive when billing_mode = 'partial_days'
ALTER TABLE invoice_rental_items
  ADD CONSTRAINT iri_partial_days_requires_num_days
    CHECK (
      billing_mode = 'full_month'
      OR (billing_mode = 'partial_days' AND num_days IS NOT NULL AND num_days > 0)
    );

COMMENT ON TABLE invoice_rental_items IS
  'Per-vehicle rental line items for rental-type invoices. SUM(subtotal) = invoices.total_taxable.';
COMMENT ON COLUMN invoice_rental_items.monthly_rent IS
  'Rate snapshot at invoice creation time — not a live FK. Historical invoices unaffected by future rate changes.';
COMMENT ON COLUMN invoice_rental_items.subtotal IS
  'Computed by UI: full_month = monthly_rent; partial_days = ROUND((monthly_rent/30)*num_days, 2).';

ALTER TABLE invoice_rental_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users manage invoice_rental_items"
  ON invoice_rental_items FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_rental_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE invoice_rental_items_id_seq TO authenticated;


-- ------------------------------------------------------------
-- 4. invoice_item_distribution
-- ------------------------------------------------------------
-- RENTAL INVOICES ONLY.
-- Maps the invoice total_taxable back to individual WO items
-- for cumulative_billed_qty tracking and utilisation bar accuracy.
--
-- Populated in Section 2 after vehicle rents are entered.
-- Default = equal split across all linked WO items.
-- User adjusts allocation_pct before finalizing.
--
-- On finalize: invoicesDb iterates rows and increments
--   work_order_items.cumulative_billed_qty += (allocated_amount / item.rate)
--
-- For QUANTITY invoices, distribution is implicit in
-- invoice_line_items — this table is not used.
--
-- UNIQUE(invoice_id, work_order_item_id): one row per WO item
-- per invoice — prevents duplicate distribution entries.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoice_item_distribution (
  id                   BIGSERIAL PRIMARY KEY,
  invoice_id           BIGINT NOT NULL
                         REFERENCES invoices(id) ON DELETE CASCADE,
  work_order_item_id   BIGINT NOT NULL
                         REFERENCES work_order_items(id) ON DELETE CASCADE,
  allocation_pct       NUMERIC NOT NULL
                         CONSTRAINT iid_pct_range
                           CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  allocated_amount     NUMERIC NOT NULL
                         CONSTRAINT iid_amount_positive
                           CHECK (allocated_amount >= 0),
  created_at           TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT iid_unique_invoice_item UNIQUE (invoice_id, work_order_item_id)
);

COMMENT ON TABLE invoice_item_distribution IS
  'RENTAL invoices only. Distributes total_taxable across WO items for cumulative_billed_qty tracking.';
COMMENT ON COLUMN invoice_item_distribution.allocation_pct IS
  'User-set percentage (0–100). Sum across all rows for one invoice must equal 100.';
COMMENT ON COLUMN invoice_item_distribution.allocated_amount IS
  'allocation_pct × invoice.total_taxable / 100. Stored for auditability and finalize logic.';

ALTER TABLE invoice_item_distribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users manage invoice_item_distribution"
  ON invoice_item_distribution FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_item_distribution TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE invoice_item_distribution_id_seq TO authenticated;


-- ------------------------------------------------------------
-- 5. vehicle_billing_ledger
-- ------------------------------------------------------------
-- Analytics/tracing table. NOT an invoice table.
-- Written automatically by invoicesDb.finalizeInvoice().
-- Reversed (deleted) by invoicesDb.cancelInvoice().
-- Never written to manually by the user.
--
-- Purpose:
--   - Track per-vehicle monthly revenue across FYs
--   - Detect vehicles not billed in a given month (dashboard alert)
--   - Monthly earnings trend per vehicle (dashboard chart)
--
-- amount per vehicle:
--   RENTAL  → exact subtotal from invoice_rental_items row
--   QUANTITY → equal split: invoices.total_taxable / count(invoice_vehicles)
--
-- financial_year: e.g. '25-26'
--   Derived from invoice_date: Apr–Mar boundary.
--   Apr 2025 – Mar 2026 → '25-26'
--   Apr 2026 – Mar 2027 → '26-27'
--   Stored as TEXT (same convention as settings.last_fy) for
--   direct string comparison in dashboard filters.
--
-- billing_month: e.g. '2026-05' (YYYY-MM)
--   Derived from invoices.billing_from date.
--   Used for "missed billing" detection and monthly trend charts.
--
-- UNIQUE(vehicle_id, invoice_id): one ledger row per vehicle
-- per invoice — safe to re-run finalize (ON CONFLICT DO NOTHING).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vehicle_billing_ledger (
  id               BIGSERIAL PRIMARY KEY,
  vehicle_id       BIGINT NOT NULL
                     REFERENCES vehicles(id),          -- no cascade: keep ledger even if vehicle deactivated
  invoice_id       BIGINT NOT NULL
                     REFERENCES invoices(id) ON DELETE CASCADE,
  work_order_id    BIGINT
                     REFERENCES work_orders(id) ON DELETE SET NULL,
  financial_year   TEXT NOT NULL,   -- e.g. '25-26' — same format as settings.last_fy
  billing_month    TEXT NOT NULL,   -- e.g. '2026-05' (YYYY-MM) from invoices.billing_from
  billing_type     TEXT NOT NULL
                     CONSTRAINT vbl_billing_type_check
                       CHECK (billing_type IN ('quantity', 'rental')),
  amount           NUMERIC(12,2) NOT NULL
                     CONSTRAINT vbl_amount_positive
                       CHECK (amount >= 0),
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT vbl_unique_vehicle_invoice UNIQUE (vehicle_id, invoice_id)
);

COMMENT ON TABLE vehicle_billing_ledger IS
  'Analytics ledger: per-vehicle monthly revenue. Written on finalize, deleted on cancel. Never edited manually.';
COMMENT ON COLUMN vehicle_billing_ledger.financial_year IS
  'e.g. ''25-26''. Derived from invoice_date using Apr–Mar FY boundary. Matches settings.last_fy format.';
COMMENT ON COLUMN vehicle_billing_ledger.billing_month IS
  'YYYY-MM derived from invoices.billing_from. Used for missed-billing detection and monthly trend queries.';
COMMENT ON COLUMN vehicle_billing_ledger.amount IS
  'Rental: exact subtotal from invoice_rental_items. Quantity: total_taxable / num_vehicles (equal split).';

ALTER TABLE vehicle_billing_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users manage vehicle_billing_ledger"
  ON vehicle_billing_ledger FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON vehicle_billing_ledger TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE vehicle_billing_ledger_id_seq TO authenticated;


-- ------------------------------------------------------------
-- Useful dashboard queries (reference — do not run as migration)
-- ------------------------------------------------------------
--
-- Total earnings per vehicle this FY:
--   SELECT v.reg_number, SUM(l.amount) AS total_earned
--   FROM vehicle_billing_ledger l JOIN vehicles v ON v.id = l.vehicle_id
--   WHERE l.financial_year = '25-26'
--   GROUP BY v.reg_number ORDER BY total_earned DESC;
--
-- Vehicles NOT billed in a given month (missed billing alert):
--   SELECT v.reg_number FROM vehicles v
--   WHERE v.is_active = true
--   AND v.id NOT IN (
--     SELECT vehicle_id FROM vehicle_billing_ledger
--     WHERE billing_month = '2026-05'
--   );
--
-- Monthly earnings trend per vehicle:
--   SELECT v.reg_number, l.billing_month, SUM(l.amount) AS monthly_total
--   FROM vehicle_billing_ledger l JOIN vehicles v ON v.id = l.vehicle_id
--   GROUP BY v.reg_number, l.billing_month
--   ORDER BY v.reg_number, l.billing_month;
-- ------------------------------------------------------------
