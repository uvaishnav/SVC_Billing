-- ============================================================
-- Migration 006: Rental Billing Support
-- Adds invoice_rental_items, invoice_item_distribution,
-- vehicle_billing_ledger, and line_item_billing_type column.
-- Run in Supabase SQL Editor or via supabase db push.
-- ============================================================

-- ── 1. invoices: add billing type column ─────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS line_item_billing_type TEXT
    NOT NULL DEFAULT 'quantity'
    CHECK (line_item_billing_type IN ('quantity', 'rental'));

COMMENT ON COLUMN invoices.line_item_billing_type IS
  'Drives Section 2 wizard UI and PDF layout path. quantity = unit-based line items; rental = monthly/partial-day rental items.';


-- ── 2. invoice_rental_items ───────────────────────────────────
-- One row per vehicle per rental invoice.
-- SUM(subtotal) for one invoice_id should equal invoices.total_taxable.
CREATE TABLE IF NOT EXISTS invoice_rental_items (
  id            BIGSERIAL PRIMARY KEY,
  invoice_id    BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  vehicle_id    BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,

  billing_mode  TEXT NOT NULL CHECK (billing_mode IN ('full_month', 'partial_days')),
  num_days      INTEGER CHECK (
                  (billing_mode = 'partial_days' AND num_days IS NOT NULL AND num_days > 0)
                  OR billing_mode = 'full_month'
                ),
  monthly_rent  NUMERIC(14, 2) NOT NULL CHECK (monthly_rent > 0),

  -- subtotal is stored (not generated) so it survives monthly_rent edits on vehicle master.
  -- App must write it as: full_month  → monthly_rent
  --                       partial_days → ROUND((monthly_rent / 30.0) * num_days, 2)
  subtotal      NUMERIC(14, 2) NOT NULL CHECK (subtotal > 0),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_rental_items_invoice
  ON invoice_rental_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_rental_items_vehicle
  ON invoice_rental_items(vehicle_id);

COMMENT ON TABLE invoice_rental_items IS
  'Vehicle-level billing rows for rental invoices. Replaces invoice_line_items when line_item_billing_type = rental.';


-- ── 3. invoice_item_distribution ─────────────────────────────
-- Maps a rental invoice total back to WO items for
-- cumulative_billed_qty tracking. Only used when billing_type = rental.
CREATE TABLE IF NOT EXISTS invoice_item_distribution (
  id                  BIGSERIAL PRIMARY KEY,
  invoice_id          BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  work_order_item_id  BIGINT NOT NULL REFERENCES work_order_items(id) ON DELETE RESTRICT,

  -- allocation_pct: 0–100, sum across invoice_id should equal 100.
  -- Enforced in app logic, not DB, to allow mid-edit states.
  allocation_pct      NUMERIC(6, 3) NOT NULL CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  allocated_amount    NUMERIC(14, 2) NOT NULL CHECK (allocated_amount >= 0),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (invoice_id, work_order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_item_distribution_invoice
  ON invoice_item_distribution(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_item_distribution_wo_item
  ON invoice_item_distribution(work_order_item_id);

COMMENT ON TABLE invoice_item_distribution IS
  'Distributes rental invoice total_taxable across work order items for utilisation tracking. allocation_pct must sum to 100 (enforced in app).';


-- ── 4. vehicle_billing_ledger ─────────────────────────────────
-- Append-only analytics table written at invoice finalization.
-- Rows are deleted when cancelInvoice() is called.
CREATE TABLE IF NOT EXISTS vehicle_billing_ledger (
  id              BIGSERIAL PRIMARY KEY,
  vehicle_id      BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  invoice_id      BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  work_order_id   BIGINT REFERENCES work_orders(id) ON DELETE SET NULL,

  financial_year  TEXT NOT NULL,              -- e.g. '25-26'
  billing_month   TEXT NOT NULL,              -- e.g. '2026-05' (YYYY-MM)
  billing_type    TEXT NOT NULL CHECK (billing_type IN ('quantity', 'rental')),

  -- rental: exact subtotal from invoice_rental_items
  -- quantity: total_taxable / num_vehicles (equal split)
  amount          NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (vehicle_id, invoice_id)  -- one row per vehicle per invoice, safe for upsert
);

CREATE INDEX IF NOT EXISTS idx_vehicle_billing_ledger_vehicle
  ON vehicle_billing_ledger(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_billing_ledger_invoice
  ON vehicle_billing_ledger(invoice_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_billing_ledger_fy
  ON vehicle_billing_ledger(financial_year);

CREATE INDEX IF NOT EXISTS idx_vehicle_billing_ledger_month
  ON vehicle_billing_ledger(billing_month);

COMMENT ON TABLE vehicle_billing_ledger IS
  'Analytics ledger: one row per vehicle per finalized invoice. Written by invoicesDb._writeVehicleLedger(), deleted by cancelInvoice().';


-- ── 5. Row Level Security (match existing pattern) ───────────
-- RLS is managed at the application level; these tables
-- inherit the authenticated-user policy from the supabase project.
-- If RLS is enabled on invoices, enable it here too:
-- ALTER TABLE invoice_rental_items        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE invoice_item_distribution   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE vehicle_billing_ledger      ENABLE ROW LEVEL SECURITY;
-- (Uncomment and add policies mirroring invoices table if needed.)
