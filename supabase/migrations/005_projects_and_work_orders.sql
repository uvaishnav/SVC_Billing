-- ============================================================
-- 005: Projects, Work Orders, Work Order Items
-- ============================================================

-- ----------------------------
-- PROJECTS
-- ----------------------------
CREATE TABLE projects (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  full_subject     TEXT,
  site_location    TEXT,
  client_id        BIGINT REFERENCES clients(id),
  place_of_supply  TEXT NOT NULL DEFAULT 'Andhra Pradesh',
  state_code       TEXT NOT NULL DEFAULT '37',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE projects_id_seq TO authenticated;

-- ----------------------------
-- WORK ORDERS
-- ----------------------------
CREATE TABLE work_orders (
  id               BIGSERIAL PRIMARY KEY,
  wo_reference     TEXT,
  client_id        BIGINT REFERENCES clients(id),
  project_id       BIGINT REFERENCES projects(id),
  subject          TEXT NOT NULL,
  issue_date       DATE NOT NULL,
  duration_months  INTEGER,
  valid_from       DATE,
  valid_to         DATE,
  total_value      NUMERIC,
  rates_firm       BOOLEAN NOT NULL DEFAULT TRUE,
  tds_applicable   BOOLEAN NOT NULL DEFAULT TRUE,
  billing_type     TEXT NOT NULL DEFAULT 'monthly_ra',
  original_pdf_url TEXT,
  extracted_text   TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON work_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON work_orders TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE work_orders_id_seq TO authenticated;

-- ----------------------------
-- WORK ORDER ITEMS
-- ----------------------------
CREATE TABLE work_order_items (
  id                    BIGSERIAL PRIMARY KEY,
  work_order_id         BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  sl_no                 INTEGER,
  description           TEXT NOT NULL,
  sub_work_ref          TEXT,
  unit                  TEXT,
  contracted_qty        NUMERIC,
  rate                  NUMERIC NOT NULL,
  amount                NUMERIC,
  cumulative_billed_qty NUMERIC NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON work_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON work_order_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE work_order_items_id_seq TO authenticated;
