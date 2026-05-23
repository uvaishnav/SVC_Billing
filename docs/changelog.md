# Changelog

> Most recent entries at the top. Each entry covers one session or feature.

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
