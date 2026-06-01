-- Migration 008: dashboard_ignores table
-- Tracks vehicle-months the user has chosen to ignore in the unbilled alert.
-- Ignored entries feed into future idle-time analytics.

CREATE TABLE IF NOT EXISTS dashboard_ignores (
  id          BIGSERIAL PRIMARY KEY,
  vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  year_month  TEXT NOT NULL,          -- format: 'YYYY-MM', e.g. '2026-05'
  ignored_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note        TEXT,                   -- optional user note ("no work this month")
  UNIQUE (vehicle_id, year_month)
);

ALTER TABLE dashboard_ignores ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage their own ignores
CREATE POLICY "auth_all" ON dashboard_ignores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_ignores TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE dashboard_ignores_id_seq TO authenticated;
