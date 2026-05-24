# Progress

> Updated at the end of every session. Checkboxes track feature completion.

***

## Current Phase

**Phase:** Phase 1 — Core MVP
**Started:** 2026-05-22
**Goal:** Build the core foundational elements — project setup, Settings, Clients Master, Vehicles Master, and PDF invoice generation.

***

## Completed

- [x] Project scaffolding (Vite, Tailwind, folder structure)
- [x] Supabase client, types, DB setup
- [x] **Settings Module** — Business profile, bank accounts, SAC codes, billing defaults, login screen (PR #1 merged)
- [x] **Clients Master Module** — Full CRUD, multi-GSTIN per client, per-GSTIN address, primary toggle, detail sheet, nav overlap fix (PR #2 merged)
- [x] **Vehicles Master Module** — Full CRUD, flat lean schema, soft-delete, detail sheet, AppShell Vehicles tab (PR #3 merged)
- [x] **Invoice Numbering** — Atomic Postgres RPC (`get_next_invoice_number`), Supabase Edge Function (`generate-invoice-number`), frontend helper (`generateInvoiceNumber()`), FY-aware reset every April 1, format `SVC/25-26/001` (PR #4 — ready to merge)

***

## Backlog

- [ ] Projects / Work References
- [ ] PDF Invoice Generation
- [ ] Invoice History
- [ ] Edit-and-replace PDF
- [ ] Dashboard
- [ ] Work Orders

***

## Session History

| Date | What happened |
|------|---------------|
| 2026-05-22 | Scaffolding, dependency installation, Tailwind CSS setup, project restructuring. |
| 2026-05-23 | Settings module — Supabase setup, DB client, types, helpers, Login screen, Settings UI. PR #1 merged. |
| 2026-05-23–24 | Clients Master — schema design (normalized), UI redesign, nav overlap fix, GSTIN save bug fix, detail sheet. PR #2 merged. |
| 2026-05-24 | Vehicles Master — lean schema design decision (no unit/rate, nullable capacity, default_monthly_rent as pre-fill hint), full CRUD UI, AppShell Vehicles tab. PR #3 merged. |
| 2026-05-24 | Invoice Numbering — GST rule research, format decided (SVC/25-26/001), atomic Postgres RPC, Edge Function with auth + exponential backoff retry, frontend helper. Supabase folder structure fixed (consolidated to repo root). Tested via curl. PR #4 ready to merge. |
