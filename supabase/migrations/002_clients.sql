-- Migration 002: Clients Master
-- Creates clients and client_gstins tables
-- Run this in Supabase SQL Editor
--
-- Schema design:
--   clients        → identity only (name, phone, email)
--   client_gstins  → one row per GST registration;
--                    each registration has its own address, state, and GSTIN
--                    because a client can be registered in multiple states
--                    with different addresses per registration.

CREATE TABLE IF NOT EXISTS clients (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_gstins (
  id          BIGSERIAL PRIMARY KEY,
  client_id   BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  gstin       TEXT NOT NULL,
  state       TEXT NOT NULL,
  state_code  TEXT NOT NULL,
  address     TEXT NOT NULL,
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

-- Grants (RLS alone is not sufficient — explicit GRANTs are required)
GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_gstins TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE clients_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE client_gstins_id_seq TO authenticated;
