# Changelog

> Most recent entries at the top. Format per entry below.

***

## [2026-05-23/24] — Clients Master Module

### Added
- `app/supabase/migrations/002_clients.sql` — `clients` and `client_gstins` tables with RLS policies and GRANTS
- `app/src/db/clientsDb.ts` — `getClients`, `getClientById`, `upsertClient`, `deactivateClient`, `upsertClientGstin`, `deleteClientGstin`, `setPrimaryGstin`
- `app/src/ui/clients/ClientsPage.tsx` — list view with sticky dark header, search bar, empty state
- `app/src/ui/clients/ClientCard.tsx` — card with avatar, state pills, GSTIN count; tap-to-open detail sheet
- `app/src/ui/clients/ClientFormModal.tsx` — bottom-sheet modal; add + edit client; per-GSTIN address/state/GSTIN entry via `GstinDraft` pattern; Set Primary; auto-promote on remove
- `app/src/ui/clients/ClientDetailSheet.tsx` — read-only bottom sheet showing all GSTINs with full addresses; Edit button opens form modal

### Changed
- `app/src/db/types.ts` — `Client` type: removed `address`, `state`, `state_code`; `ClientGstin` type: added `address`
- `app/src/ui/AppShell.tsx` — nav overlap fix: page content now scrolls in a container with `paddingBottom: 64px`; tab bar is `position: fixed`

### Observations (problems hit and fixed — read before building similar features)
1. **GSTIN not saving to DB** — Root cause: Supabase `.upsert()` without `onConflict` silently no-ops on composite unique constraints. Fix: always pass `{ onConflict: 'client_id,gstin' }` (or the relevant columns) when upserting into tables with non-PK unique keys.
2. **`+` button wiping form state** — Root cause: button inside a component without `type="button"` triggers browser form submit, which resets state. Fix: every button that is NOT a final submit must have `type="button"` explicitly.
3. **Race condition on GSTIN draft** — Root cause: three separate state variables (`newGstin`, `newState`, `newAddress`) don’t update atomically; reading them in a click handler captured stale values. Fix: use a single `GstinDraft` object updated via `setDraft(d => ({ ...d, field: value }))`.
4. **Nav bar covering Settings page** — Root cause: `SettingsPage` root had `min-height: 100svh` which painted behind the fixed nav. Fix: page roots use `min-height: 100%`; `AppShell` wraps content in a scrollable div with `paddingBottom` equal to nav height.
5. **Schema: address on wrong table** — Originally `address` was on `clients`. Moved to `client_gstins` because a client’s registered address is per-state GST registration, not per-client identity. Future modules reading client address for invoice generation must read from the selected `client_gstins` row, not from `clients`.

***

## [2026-05-23] — Settings Module

### Added
- Supabase project setup (DB, Auth, Storage, RLS)
- `app/src/db/supabaseClient.ts` — typed Supabase client
- `app/src/db/types.ts` — initial types: `Settings`, `BankAccount`, `SacCode`
- `app/src/db/settingsDb.ts` — `getSettings`, `upsertSettings`, `patchSettings`, `getBankAccounts`, `upsertBankAccount`, `deactivateBankAccount`, `getSacCodes`, `upsertSacCode`, `deactivateSacCode`
- `app/supabase/migrations/001_settings.sql` — `settings`, `bank_accounts`, `sac_codes` tables
- `app/src/ui/LoginScreen.tsx` — email/password login
- `app/src/ui/settings/SettingsPage.tsx` — full settings UI (business profile, bank accounts, SAC codes, billing defaults)
- `app/src/ui/settings/_components.tsx` — shared primitives: `Field`, `PrimaryButton`, `cardStyle`, `sectionTitleStyle`, `inputStyle`, `labelStyle`
- `app/src/ui/AppShell.tsx` — bottom tab bar shell

### Observations
1. Supabase RLS alone is not sufficient — explicit `GRANT SELECT, INSERT, UPDATE` to `authenticated` role is required or all queries return empty/403.
2. Sequence GRANTs (`GRANT USAGE, SELECT ON SEQUENCE`) are required for `BIGSERIAL` columns or inserts fail with permission denied.
