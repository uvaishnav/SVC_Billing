# Changelog

> Most recent entries first.

***

## [2026-05-24] — Invoice Numbering

### Added
- `supabase/migrations/004_invoice_numbering.sql` — adds `last_fy TEXT` column to `settings`; creates `get_next_invoice_number()` Postgres function with `FOR UPDATE` row lock, FY detection, automatic reset on April 1, and atomic write-back of `current_sequence`, `last_fy`, `last_invoice_number`
- `supabase/functions/generate-invoice-number/index.ts` — Deno Edge Function; verifies JWT (authenticated users only); calls `get_next_invoice_number()` RPC; exponential backoff retry (4 attempts: 0 → 100 → 200 → 400ms)
- `app/src/db/invoiceNumberingDb.ts` — `generateInvoiceNumber(): Promise<string>` frontend helper; reads session JWT, calls Edge Function, returns formatted invoice number (e.g. `SVC/25-26/001`); throws descriptive errors for caller to handle
- `app/src/db/types.ts` — added `last_fy: string | null` to `Settings` interface
- `supabase/migrations/002_clients.sql` — moved to correct repo root location (was incorrectly in `app/supabase/migrations/`)

### Changed
- `docs/architecture.md` — corrected folder structure (single `supabase/` at repo root, no `app/supabase/`); added Supabase CLI rules 6, 7, 8

### Removed
- `app/supabase/migrations/002_clients.sql` — deleted stale duplicate; canonical version is at `supabase/migrations/002_clients.sql`

### Observations
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into Edge Functions at runtime — no manual `secrets set` needed for these
- Postgres `FOR UPDATE` row lock naturally serializes concurrent calls; retry layer handles the rare lock-timeout edge case
- FY stored as `last_fy` TEXT (e.g. `"25-26"`) rather than a year integer — more readable in DB, and the comparison logic is simpler
- Tested via `curl` with a live JWT — confirmed sequential increment and DB write-back

***

## [2026-05-24] — Vehicles Master

### Added
- `supabase/migrations/003_vehicles.sql` — `vehicles` table with RLS + explicit GRANTs on table and sequence
- `app/src/db/vehiclesDb.ts` — `getVehicles`, `upsertVehicle`, `deactivateVehicle` helpers
- `app/src/db/types.ts` — `Vehicle` interface + `vehicles` entry in `Database` type map
- `app/src/ui/vehicles/VehiclesPage.tsx` — list page with sticky header, search, loading/empty states
- `app/src/ui/vehicles/VehicleCard.tsx` — card showing reg number, type, capacity chip, monthly rent chip
- `app/src/ui/vehicles/VehicleFormModal.tsx` — bottom-sheet form for add/edit; reg number auto-uppercased
- `app/src/ui/vehicles/VehicleDetailSheet.tsx` — read-only detail sheet, 2-column grid layout
- `app/src/ui/AppShell.tsx` — added Vehicles tab (between Clients and Settings)

### Observations
- Billing mode analysis (unit-based vs rental) led to removing `unit` and `default_rate` from schema — unit rates are work-order-driven, not vehicle-driven
- `default_monthly_rent` kept as nullable pre-fill hint for rental invoices
- All fields except `reg_number` are nullable by design — user fills incrementally
- Flat single-table design (no child tables) — vehicles have no multi-valued attributes

***

## [2026-05-23–24] — Clients Master

### Added
- `supabase/migrations/002_clients.sql` — `clients` + `client_gstins` tables
- `app/src/db/clientsDb.ts` — full CRUD helpers including `setPrimaryGstin`, `deleteClientGstin`
- `app/src/ui/clients/` — `ClientsPage`, `ClientCard`, `ClientFormModal`, `ClientDetailSheet`

### Changed
- `app/src/ui/AppShell.tsx` — nav overlap fix; `paddingBottom: 64px` on scrollable content area
- `app/src/db/types.ts` — added `Client`, `ClientGstin`, `ClientWithGstins`

### Observations
- Address belongs on `client_gstins` not `clients` (multi-state clients have different registered addresses per GSTIN)
- `GstinDraft` pattern prevents race conditions in multi-item form state
- `upsertClientGstin` requires `{ onConflict: 'client_id,gstin' }` — composite unique key
- All `+ Add` buttons must carry `type="button"` explicitly

***

## [2026-05-23] — Settings Module

### Added
- `supabase/migrations/001_settings.sql` — `settings`, `bank_accounts`, `sac_codes` tables
- `app/src/db/settingsDb.ts` — `getSettings`, `upsertSettings`, `patchSettings`, bank account and SAC CRUD
- `app/src/ui/settings/` — `SettingsPage`, `BusinessProfileForm`, `BankAccountsSection`, `SacCodesSection`, `BillingDefaultsForm`, `_components.tsx`
- `app/src/ui/LoginScreen.tsx` — Supabase Auth login

### Observations
- Single-row `settings` table works well; `patchSettings` vs `upsertSettings` split avoids NOT NULL violations
- Separate `bank_accounts` and `sac_codes` tables future-proof multi-account and multi-code support
