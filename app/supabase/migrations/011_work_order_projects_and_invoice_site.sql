-- ============================================================
-- Migration 011: Link Projects to Work Orders & Invoices to Projects (Site Billing)
-- ============================================================

-- 1. Add work_order_id to projects (1 Work Order -> Many Projects/Sites)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS work_order_id BIGINT REFERENCES work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_work_order_id
  ON projects(work_order_id);

COMMENT ON COLUMN projects.work_order_id IS
  'Work order / contract this project site belongs to. A work order can have multiple projects.';

-- 2. Add project_id to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_project_id
  ON invoices(project_id);

COMMENT ON COLUMN invoices.project_id IS
  'Project / site location being billed. Work order items are drawn from this project''s linked work order.';

-- 3. Backfill projects.work_order_id from any legacy work_orders.project_id
UPDATE projects p
SET work_order_id = wo.id
FROM work_orders wo
WHERE wo.project_id = p.id AND p.work_order_id IS NULL;

-- 4. Initial backfill for existing invoices where a work order is linked to projects
UPDATE invoices i
SET project_id = p.id
FROM projects p
WHERE p.work_order_id = i.work_order_id
  AND i.project_id IS NULL;
