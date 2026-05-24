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
- [x] **Clients Master Module** — Full CRUD, multi-GSTIN per client, per-GSTIN address, primary toggle, detail sheet, nav overlap fix (PR #2 — ready to merge)
- [x] **Vehicles Master Module** — Full CRUD, flat lean schema, soft-delete, detail sheet, AppShell Vehicles tab (PR #3)

***

## Currently In Progress

- [ ] **Invoice Numbering** — Edge Function for centralized, FY-aware sequence generation

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
| 2026-05-23–24 | Clients Master — schema design (normalized), UI redesign, nav overlap fix, GSTIN save bug fix, detail sheet. PR #2 in branch `feature/clients-master-20260523`. |
| 2026-05-24 | Vehicles Master — lean schema design decision (no unit/rate, nullable capacity, default_monthly_rent as pre-fill hint), full CRUD UI, AppShell Vehicles tab. PR #3. |
