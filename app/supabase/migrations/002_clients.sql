-- Migration 002: Clients Master
-- Creates clients table and client_gstins table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS clients (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  state       TEXT NOT NULL,
  state_code  TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_gstins (
  id          BIGSERIAL PRIMARY KEY,
  client_id   BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  state       TEXT NOT NULL,
  state_code  TEXT NOT NULL,
  gstin       TEXT NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, gstin)
);

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_gstins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage clients"
  ON clients FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage client_gstins"
  ON client_gstins FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
