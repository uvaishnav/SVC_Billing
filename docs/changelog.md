# Changelog

> Most recent entries at the top. Each entry covers one session or feature.

***

## [2026-05-23] — Clients Master Module + Nav Shell

### Added
- `app/supabase/migrations/002_clients.sql` — `clients` and `client_gstins` tables with RLS policies (run in Supabase SQL Editor)
- `app/src/db/types.ts` — Added `Client`, `ClientGstin`, `ClientWithGstins` interfaces; updated `Database` type map
- `app/src/db/clientsDb.ts` — DB helpers: `getClients`, `getClientById`, `upsertClient`, `deactivateClient`, `upsertClientGstin`, `deleteClientGstin`, `setPrimaryGstin`
- `app/src/ui/clients/ClientsPage.tsx` — List screen with search (name + GSTIN), empty state, add/edit/remove
- `app/src/ui/clients/ClientCard.tsx` — Card showing name, address, primary GSTIN, state badge, multi-GSTIN count
- `app/src/ui/clients/ClientFormModal.tsx` — Add/Edit modal with full client fields and per-state GSTIN management
- `app/src/ui/AppShell.tsx` — Bottom-tab nav shell with Clients and Settings tabs; new tabs are a one-line addition per feature

### Changed
- `app/src/ui/App.tsx` — Replaced hardcoded `<SettingsPage />` with `<AppShell />` so the app is now navigable
- `docs/design-decisions.md` — Added decisions for `client_gstins` separate table and nav shell timing

### Observations
- Supabase nested select (`select('*, gstins:client_gstins(*)')`) works cleanly for one-to-many relationships without a manual join
- First GSTIN added in the modal is automatically marked `is_primary = true`; subsequent ones are non-primary
- `setPrimaryGstin` uses a two-step update (unset all → set chosen) since Supabase JS doesn't support conditional UPDATE in one call

***

## [2026-05-23] — Settings Module

### Added
- `app/src/db/supabaseClient.ts` — Supabase JS client with env var validation
- `app/src/db/types.ts` — TypeScript types for `Settings`, `BankAccount`, `SacCode` and `Database` generic
- `app/src/db/settingsDb.ts` — DB helpers: `getSettings`, `upsertSettings`, `patchSettings`, CRUD for bank accounts and SAC codes
- `app/src/db/index.ts` — central re-export for all DB helpers
- `app/src/ui/auth/LoginScreen.tsx` — branded login screen using Supabase Auth
- `app/src/ui/settings/SettingsPage.tsx` — 4-tab settings shell (Business / Banks / SAC Codes / Defaults)
- `app/src/ui/settings/BusinessProfileForm.tsx` — business name, address, GSTIN, PAN, state, signatory
- `app/src/ui/settings/BankAccountsSection.tsx` — add/edit/remove/set-default bank accounts
- `app/src/ui/settings/SacCodesSection.tsx` — add/edit/remove/set-default SAC codes
- `app/src/ui/settings/BillingDefaultsForm.tsx` — TDS rate, GST defaults, invoice prefix, sequence padding, default selections
- `app/src/ui/settings/_components.tsx` — shared styled primitives (Field, PrimaryButton, SavedBadge, cardStyle, etc.)
- `app/src/ui/App.tsx` — root app with auth gate (LoginScreen if not logged in, SettingsPage if logged in)
- Supabase tables created: `settings`, `bank_accounts`, `sac_codes` with RLS + policies + grants
- `sac_codes` pre-seeded with Equipment Rental (997319) and Construction Work (9954)

### Changed
- `app/src/index.css` — replaced Vite boilerplate with full brand token system (CSS variables, correct fonts, fixed `#root` layout)

### Observations
- Supabase tables created via raw SQL require explicit `GRANT` statements in addition to RLS policies — RLS alone is not sufficient
- `upsert` with partial fields fails on `NOT NULL` columns; introduced `patchSettings` (pure UPDATE) for partial setting changes like setting defaults
- Vite 8 required a clean `node_modules` wipe after installing `@supabase/supabase-js` due to `tslib` pre-bundling issue

***

## [2026-05-22] — Project Scaffolding

### Added
- Initial Vite + React + TypeScript project setup
- Tailwind CSS configuration
- Initial folder structure (`core`, `db`, `ui`, `pdf`, `integrations`, `offline`)
- Gemini workflow documentation system
