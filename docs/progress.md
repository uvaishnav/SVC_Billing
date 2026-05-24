# Progress

> Updated at the end of every session. Checkboxes track feature completion.

***

## Current Phase

**Phase:** Phase 1 — Core MVP (mostly done) + Phase 2 — Work Order Intelligence (in progress)
**Started:** 2026-05-22
**Goal:** Core foundational elements done. Now completing the Work Orders module with PDF upload + OCR + AI parsing, then moving to PDF invoice generation.

***

## Completed

- [x] Project scaffolding (Vite, Tailwind, folder structure)
- [x] Supabase client, types, DB setup
- [x] **Settings Module** — Business profile, bank accounts, SAC codes, billing defaults, login screen (PR #1 merged)
- [x] **Clients Master Module** — Full CRUD, multi-GSTIN per client, per-GSTIN address, primary toggle, detail sheet, nav overlap fix (PR #2 merged)
- [x] **Vehicles Master Module** — Full CRUD, flat lean schema, soft-delete, detail sheet, AppShell Vehicles tab (PR #3 merged)
- [x] **Invoice Numbering** — Atomic Postgres RPC (`get_next_invoice_number`), Supabase Edge Function (`generate-invoice-number`), frontend helper (`generateInvoiceNumber()`), FY-aware reset every April 1, format `SVC/25-26/001` (PR #4 — ready to merge)
- [x] **Work Orders Module — Part 1 (Manual Entry)** — Projects CRUD, Work Orders CRUD with line items, status filter pills, live status computation (active / expiring_soon / expired / closed), utilisation progress bars in detail sheet, Projects tab + Work Orders tab in AppShell (PR #5 — tested and working)

***

## In Progress — Next Session

### Work Orders Module — Part 2: PDF Upload + OCR + AI Parsing

This is the continuation of the Work Orders module. The manual entry (PR #5) is done. What remains:

- [ ] **Upload WO PDF** to Supabase Storage bucket `work-orders` (bucket already created)
- [ ] **OCR extraction** — Tesseract.js in-browser text extraction from uploaded PDF
- [ ] **AI-assisted parsing** — send extracted text to AI, get back structured JSON (wo_reference, issue_date, subject, duration_months, total_value, items array)
- [ ] **Preview + correction UI** — show AI-extracted fields prefilled in the existing `WorkOrderFormModal`, user reviews and confirms
- [ ] **Store `original_pdf_url`** on the `work_orders` row after successful upload
- [ ] **"Upload WO" button** in WorkOrdersPage — launches the upload→OCR→parse→prefill flow

**Design already decided (see design-decisions.md):**
- OCR runs entirely in-browser via Tesseract.js — no server-side OCR needed
- AI parsing call goes via a Supabase Edge Function (`parse-work-order`) to protect the API key
- The result prefills `WorkOrderFormModal` — user can correct before saving
- PDF stored in the `work-orders` bucket; URL saved in `work_orders.original_pdf_url`

***

## Backlog (after Work Orders Part 2)

- [ ] PDF Invoice Generation (multi-step wizard + jsPDF rendering + Supabase Storage upload)
- [ ] Invoice History
- [ ] Edit-and-replace PDF
- [ ] Dashboard

***

## Session History

| Date | What happened |
|------|---------------|
| 2026-05-22 | Scaffolding, dependency installation, Tailwind CSS setup, project restructuring. |
| 2026-05-23 | Settings module — Supabase setup, DB client, types, helpers, Login screen, Settings UI. PR #1 merged. |
| 2026-05-23–24 | Clients Master — schema design (normalized), UI redesign, nav overlap fix, GSTIN save bug fix, detail sheet. PR #2 merged. |
| 2026-05-24 | Vehicles Master — lean schema design decision (no unit/rate, nullable capacity, default_monthly_rent as pre-fill hint), full CRUD UI, AppShell Vehicles tab. PR #3 merged. |
| 2026-05-24 | Invoice Numbering — GST rule research, format decided (SVC/25-26/001), atomic Postgres RPC, Edge Function with auth + exponential backoff retry, frontend helper. Supabase folder structure fixed. Tested via curl. PR #4 ready to merge. |
| 2026-05-24 | Work Orders Module Part 1 — SQL migration (projects + work_orders + work_order_items), types, DB helpers (projectsDb + workOrdersDb), full UI for Projects and Work Orders including form modals, detail sheets, status pills, utilisation bars. AppShell expanded to 5 tabs. PR #5 tested and working. |
