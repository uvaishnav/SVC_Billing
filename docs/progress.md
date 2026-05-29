# Progress

> Updated at the end of every session. Checkboxes track feature completion.

***

## Current Phase

**Phase:** Phase 3 — PDF Invoice Generation (in progress).
**Started:** 2026-05-26
**Goal:** Build GST-compliant invoice creation wizard, PDF rendering, and invoice history. Working in 3 sub-parts:
- ✅ **Part 1** — GST compliance audit + invoice field spec locked
- ✅ **Part 2** — Invoice creation wizard UI + DB schema + AI description flow
- ✅ **Rental Billing** — Schema + Wizard UI + AI description fix (dedicated session 2026-05-28)
- 🔜 **Part 3** (next session) — PDF rendering logic, jsPDF layout (quantity + rental paths), design + aesthetics

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
- [x] **PDF Invoice Generation — Part 2 (Invoice Wizard UI + Data Flow)** — DB schema (`invoices`, `invoice_line_items`, `invoice_vehicles`), full 4-section wizard (client/period/WO/SAC/bank → line items → vehicles+AI description → review+finalize), `invoicesDb.ts` with save draft + finalize + cancel, `cumulative_billed_qty` updated on finalize, invoice list page with status pills. Invoice number assigned at finalize only (never on wizard open). Finalized invoice number locked forever on re-edit. Billing period defaults to 1st–last day of previous month using local timezone-safe date helpers. (PR branch: `feature/invoice-wizard-part2-20260527`)
- [x] **Rental Billing Schema + Wizard UI** — SQL migration 006 (`invoice_rental_items`, `invoice_item_distribution`, `vehicle_billing_ledger`, `line_item_billing_type` column on `invoices`), types.ts updated, invoicesDb.ts updated for rental finalize path, Section 2 wizard UI with monthly/quantity billing mode selector + distribution panel, AI description fixed (no per-day rate language, rental-specific prompt). (PR branch: `feature/rental-billing-schema-20260528`)

***

## ⚠️ Resolved — Vehicle Rental Billing (Completed 2026-05-28)

Originally deferred from the 2026-05-27 session. Completed in a dedicated session on 2026-05-28.
See changelog entry `[2026-05-28]` for full implementation details.

***

## In Progress — Next Session

### PDF Invoice Generation — Part 3: PDF Rendering

- [ ] jsPDF layout — **quantity invoice** PDF path: multi-row line items table (Sl. No / Description / SAC / Unit / Qty / Rate / Taxable Value)
- [ ] jsPDF layout — **rental invoice** PDF path: vehicle rental table (Vehicle / Billing Period / Mode / Days / Monthly Rent / Amount); no qty/unit columns
- [ ] PDF preview in-app (before download/share)
- [ ] Upload generated PDF to Supabase Storage (`invoices` bucket)
- [ ] Storage RLS policies for `invoices` bucket
- [ ] Download + Share PDF from invoice detail / list page

> ⚠️ **Critical for PDF rendering:** Check `invoice.line_item_billing_type` first — `'quantity'` renders `invoice_line_items`, `'rental'` renders `invoice_rental_items` + shows distribution summary. Two completely separate jsPDF layout functions needed.

***

## Backlog

- [ ] PDF Invoice Generation — Part 3: jsPDF rendering + PDF preview + upload to Supabase Storage (`invoices` bucket)
- [ ] Invoice History — list, search, download
- [ ] Edit-and-replace invoice PDF
- [ ] Dashboard — revenue summary, active WOs, expiring soon, **revenue per vehicle** (enabled by `vehicle_billing_ledger`)
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
| 2026-05-27 | PDF Invoice Generation Part 2 — Full invoice wizard (4 sections), invoicesDb.ts, invoice list page, invoice number assigned at finalize only, finalized number locked on re-edit, billing period defaults to prev month (timezone-safe), UI accessibility + color scheme fixes, UTC→IST date bug fixed in prevMonthRange(). Vehicle rental billing requirement discovered — deferred to next session. PR branch: `feature/invoice-wizard-part2-20260527`. |
| 2026-05-28 | Rental Billing — SQL migration 006, types.ts, invoicesDb.ts, Section 2 rental UI (monthly/partial days + distribution panel), AI description fixed (no per-day rate). PR branch: `feature/rental-billing-schema-20260528`. |
