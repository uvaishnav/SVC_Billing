-- ─────────────────────────────────────────────────────────────
-- Migration 009: payments & payment_allocations
-- ─────────────────────────────────────────────────────────────

-- 1. Payments Table (Records any payment receipt from a client)
CREATE TABLE IF NOT EXISTS payments (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  payment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  amount            NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_mode      TEXT,                     -- Optional: 'bank_transfer', 'cheque', 'cash', 'upi', 'other'
  reference_number  TEXT,                     -- Optional: UTR #, Cheque #, RTGS Ref
  notes             TEXT,                     -- Optional notes
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Payment Allocations Table (Links a payment to one or more invoices)
CREATE TABLE IF NOT EXISTS payment_allocations (
  id                SERIAL PRIMARY KEY,
  payment_id        INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id        INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  allocated_amount  NUMERIC(12,2) NOT NULL CHECK (allocated_amount > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_id, invoice_id)
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id ON payment_allocations(invoice_id);

-- 4. Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users full access on payments" ON payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth users full access on payment_allocations" ON payment_allocations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
