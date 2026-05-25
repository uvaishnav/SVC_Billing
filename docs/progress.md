# Progress

> Updated at the end of every session. Checkboxes track feature completion.

***

## Current Phase

**Phase:** Phase 2 — Work Order Intelligence ✅ complete. Moving to Phase 3 — PDF Invoice Generation.
**Started:** 2026-05-22
**Goal:** Core MVP + Work Orders with PDF intelligence done. Next: PDF invoice generation wizard.

***

## Completed

- [x] Project scaffolding (Vite, Tailwind, folder structure)
- [x] Supabase client, types, DB setup
- [x] **Settings Module** — Business profile, bank accounts, SAC codes, billing defaults, login screen (PR #1 merged)
- [x] **Clients Master Module** — Full CRUD, multi-GSTIN per client, per-GSTIN address, primary toggle, detail sheet, nav overlap fix (PR #2 merged)
- [x] **Vehicles Master Module** — Full CRUD, flat lean schema, soft-delete, detail sheet, AppShell Vehicles tab (PR #3 merged)
- [x] **Invoice Numbering** — Atomic Postgres RPC (`get_next_invoice_number`), Supabase Edge Function (`generate-invoice-number`), frontend helper (`generateInvoiceNumber()`), FY-aware reset every April 1, format `SVC/25-26/001` (PR #4 — ready to merge)
- [x] **Work Orders Module — Part 1 (Manual Entry)** — Projects CRUD, Work Orders CRUD with line items, status filter pills, live status computation (active / expiring_soon / expired / closed), utilisation progress bars in detail sheet, Projects tab + Work Orders tab in AppShell (PR #5 — tested and working)
- [x] **Work Orders Module — Part 2 (PDF Upload + OCR + AI Parsing)** — In-browser OCR (Tesseract.js), Supabase Edge Function with Gemini 2.5 Flash primary + Groq Llama 3.3 70B fallback (on 429 AND 503), prefill flow with editable items, private Storage bucket with signed URLs, retroactive PDF attach via Edit form, View PDF button in detail sheet (PR branch: `feature/wo-pdf-upload-ocr-ai-20260525`)

***

## In Progress — Next Session

### PDF Invoice Generation

- [ ] Multi-step invoice creation wizard
  - Step 1: Select Work Order + billing period
  - Step 2: Enter quantities per line item (auto-calculates amounts)
  - Step 3: Review invoice summary (GST, TDS deduction if applicable)
  - Step 4: Generate PDF (jsPDF) and preview
- [ ] Store invoice in Supabase (`invoices` + `invoice_items` tables)
- [ ] Upload generated PDF to Supabase Storage (`invoices` bucket)
- [ ] Invoice list page with status (draft / sent / paid)
- [ ] Update `cumulative_billed_qty` on work order items after invoice is created

***

## Backlog

- [ ] Invoice History — list, search, download
- [ ] Edit-and-replace invoice PDF
- [ ] Dashboard — revenue summary, active WOs, expiring soon
- [ ] Supabase Storage RLS policies — already added for `work-orders` bucket; add equivalent for `invoices` bucket when that feature is built

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
| 2026-05-25 | Work Orders Module Part 2 — OCR + AI parsing pipeline, private Storage bucket with signed URLs, Gemini+Groq fallback (429 + 503), prefillable + editable form, retroactive PDF attach, View PDF in detail sheet, active filter default, Storage RLS policies added via SQL Editor. Edge Function deployed. PR branch ready. |
