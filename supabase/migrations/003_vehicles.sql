-- 003_vehicles.sql
-- Vehicles master table

CREATE TABLE IF NOT EXISTS vehicles (
  id                   BIGSERIAL PRIMARY KEY,
  reg_number           TEXT NOT NULL UNIQUE,
  vehicle_type         TEXT,
  capacity             NUMERIC,
  capacity_unit        TEXT,
  default_monthly_rent NUMERIC,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON vehicles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Explicit grants (required — RLS alone is not enough)
GRANT SELECT, INSERT, UPDATE ON vehicles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE vehicles_id_seq TO authenticated;
