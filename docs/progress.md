# Progress

> Updated at the end of every session. Checkboxes track feature completion.

***

## Current Phase

**Phase:** Phase 3 — PDF Invoice Generation (in progress).
**Started:** 2026-05-26
**Goal:** Build GST-compliant invoice creation wizard, PDF rendering, and invoice history. Working in 3 sub-parts:
- ✅ **Part 1** (this session) — GST compliance audit + invoice field spec locked
- 🔜 **Part 2** (next session) — Invoice creation wizard UI + DB schema + AI description flow
- ⏳ **Part 3** (session after) — PDF rendering logic, jsPDF layout, design + aesthetics

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
- [x] **PDF Invoice Generation — Part 1 (Field Spec + GST Compliance Audit)** — All 17 mandatory GST fields verified against Rule 46 CGST Rules 2017, invoice field spec locked, 3 design decisions made and documented (TDS display, vehicle visibility, line item structure). See `docs/design-decisions.md` entries dated 2026-05-26.

***

## In Progress — Next Session (Part 2)

### PDF Invoice Generation — Part 2: Invoice Wizard UI + Data Flow

- [ ] DB schema — `invoices`, `invoice_line_items`, `invoice_vehicles` tables + SQL migration
- [ ] `invoicesDb.ts` — DB helpers for creating, listing, updating invoices
- [ ] Multi-step invoice creation wizard UI
  - Step 1: Invoice header — client, billing period (from/to dates), invoice date, work order link
  - Step 2: Line items — select WO items, enter qty, rate pre-filled, override warning if rate changed
  - Step 3: Vehicles — multi-select (internal tracking only, not printed separately)
  - Step 4: Description — AI auto-generate from structured data + user edit
  - Step 5: Review summary — taxable value, GST, TDS (informational), net receivable, bank account selection
- [ ] Save draft invoice to Supabase
- [ ] Update `cumulative_billed_qty` on linked `work_order_items` after invoice is finalized
- [ ] Invoice list page with status (draft / final / cancelled)

***

## Backlog

- [ ] PDF Invoice Generation — Part 3: jsPDF rendering + PDF preview + upload to Supabase Storage (`invoices` bucket)
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
| 2026-05-26 | PDF Invoice Generation Part 1 — GST compliance audit (Rule 46 CGST), invoice field spec locked, 3 design decisions confirmed (TDS as informational line, vehicles internal-only, multi-row line items). No code this session — pure spec + docs. |
