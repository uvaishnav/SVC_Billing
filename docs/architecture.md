# Architecture

> Updated whenever a new module is added or the structure changes.

***

## Overview

Mobile-first PWA (React + Vite) — Supabase backend (Postgres + Auth + Storage + Edge Functions).

- **Frontend:** React 18, TypeScript, Vite, inline CSS + CSS variables (no Tailwind on UI components)
- **Backend:** Supabase (Postgres, Auth, RLS, Storage, Edge Functions for invoice numbering)
- **Hosting:** Vercel (auto-deploy from `main`)
- **PDF generation:** jsPDF + html2canvas (in-browser)
- **Fonts:** Playfair Display (headings), Work Sans (body) — loaded from Google Fonts

***

## Folder Structure

```
(repo root)/
  supabase/                     ← ALL Supabase config lives HERE (repo root)
    migrations/                 ← Run manually in Supabase SQL Editor, in order
      001_settings.sql
      002_clients.sql
      003_vehicles.sql
      004_invoice_numbering.sql
    functions/                  ← Edge Functions deployed via Supabase CLI from repo root
      generate-invoice-number/
        index.ts
  app/                          ← React frontend ONLY — no supabase config here
    src/
      db/
        supabaseClient.ts   — typed Supabase client singleton
        types.ts            — all table row types + Database interface
        settingsDb.ts       — Settings, BankAccounts, SacCodes DB helpers
        clientsDb.ts        — Clients, ClientGstins DB helpers
        vehiclesDb.ts       — Vehicles DB helpers
        invoiceNumberingDb.ts — generateInvoiceNumber() — calls Edge Function
      ui/
        LoginScreen.tsx
        AppShell.tsx        — tab bar + page router (Clients | Vehicles | Settings)
        settings/
          _components.tsx   — shared UI primitives (REUSE IN ALL MODULES)
          SettingsPage.tsx
          BusinessProfileForm.tsx
          BankAccountsSection.tsx
          SacCodesSection.tsx
          BillingDefaultsForm.tsx
        clients/
          ClientsPage.tsx
          ClientCard.tsx
          ClientFormModal.tsx
          ClientDetailSheet.tsx
        vehicles/
          VehiclesPage.tsx
          VehicleCard.tsx
          VehicleFormModal.tsx
          VehicleDetailSheet.tsx
  docs/
    progress.md
    architecture.md
    design-decisions.md
    changelog.md
  PRD.md
```

> ⚠️ **IMPORTANT — Supabase CLI rule:** Always `cd` to the **repo root** before running any
> `supabase` CLI commands (`supabase link`, `supabase functions deploy`, etc.).
> Never run them from inside `app/`. The CLI reads `supabase/` relative to your working directory.

***

## Database Schema

### `settings` (single row, always `id = 1`)
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | Always 1 |
| business_name | TEXT NOT NULL | |
| address | TEXT NOT NULL | |
| gstin | TEXT NOT NULL | |
| pan | TEXT | |
| state | TEXT NOT NULL | Always Andhra Pradesh |
| state_code | TEXT NOT NULL | Always 37 |
| phone | TEXT | |
| email | TEXT | |
| authorized_signatory | TEXT NOT NULL | |
| logo_url | TEXT | Supabase Storage URL |
| invoice_prefix | TEXT NOT NULL | default SVC |
| current_sequence | INTEGER NOT NULL | resets April 1 |
| sequence_padding | INTEGER NOT NULL | default 3 |
| last_invoice_number | TEXT | last generated invoice number |
| last_fy | TEXT | e.g. "25-26" — used to detect FY change for sequence reset |
| default_sac_id | BIGINT FK → sac_codes | |
| default_tds_rate | NUMERIC NOT NULL | default 2 |
| tds_applicable | BOOLEAN NOT NULL | |
| reverse_charge_applicable | BOOLEAN NOT NULL | |
| default_billing_period | TEXT NOT NULL | |
| default_bank_account_id | BIGINT FK → bank_accounts | |

### `bank_accounts`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| nickname | TEXT NOT NULL | shown in dropdowns |
| account_name | TEXT NOT NULL | |
| account_number | TEXT NOT NULL | |
| ifsc | TEXT NOT NULL | |
| bank_name | TEXT NOT NULL | |
| branch | TEXT | |
| is_active | BOOLEAN NOT NULL | soft-delete |
| created_at | TIMESTAMPTZ | |

### `sac_codes`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| nickname | TEXT NOT NULL | |
| sac_code | TEXT NOT NULL | |
| description | TEXT | |
| is_active | BOOLEAN NOT NULL | |

### `clients`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| name | TEXT NOT NULL | |
| phone | TEXT | |
| email | TEXT | |
| is_active | BOOLEAN NOT NULL | soft-delete |
| created_at | TIMESTAMPTZ | |

> ⚠️ `clients` does NOT have `address`, `state`, or `state_code`. These live on `client_gstins`.

### `client_gstins`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| client_id | BIGINT FK → clients | CASCADE DELETE |
| gstin | TEXT NOT NULL | |
| state | TEXT NOT NULL | |
| state_code | TEXT NOT NULL | |
| address | TEXT NOT NULL | registered address for this GST registration |
| is_primary | BOOLEAN NOT NULL | one per client should be true |
| created_at | TIMESTAMPTZ | |
| | UNIQUE(client_id, gstin) | composite unique constraint |

> ⚠️ For invoice generation: read recipient address + GSTIN from the **selected `client_gstins` row**, never from `clients`.

### `vehicles`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| reg_number | TEXT NOT NULL UNIQUE | auto-uppercased in UI |
| vehicle_type | TEXT | nullable — e.g. Tipper, Dumper |
| capacity | NUMERIC | nullable — physical spec only |
| capacity_unit | TEXT | nullable — e.g. CUM, TON |
| default_monthly_rent | NUMERIC | nullable — pre-fill hint for rental invoices |
| is_active | BOOLEAN NOT NULL | soft-delete |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

> ⚠️ No unit-rate fields on vehicles. Unit-based billing rates are work-order-driven.
> ⚠️ `default_monthly_rent` is a nullable hint, not a contract. User overrides per invoice.

***

## UI Patterns (mandatory for all modules)

### 1. Styling
- **Always** use inline CSS with CSS variables from `index.css`
- **Never** use Tailwind utility classes on UI components — it breaks design consistency
- CSS variables: `--color-primary`, `--color-bg`, `--color-accent`, `--color-surface`, `--color-surface-offset`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-text-faint`, `--color-success`, `--color-warning`, `--color-error`, `--color-info`
- Fonts: `Playfair Display` for headings (h1–h3), `Work Sans` for body/inputs

### 2. Shared primitives — import from `settings/_components.tsx`
```ts
import { Field, PrimaryButton, cardStyle, sectionTitleStyle, inputStyle, labelStyle } from '../settings/_components'
```
Never redeclare these. Always import.

### 3. Page root
- Root div: `style={{ minHeight: '100%', background: 'var(--color-bg)' }}`
- Do NOT use `min-height: 100svh` — AppShell handles full height; using 100svh causes content to be hidden behind the fixed nav bar

### 4. Sticky page header pattern
```tsx
<div style={{ background: 'var(--color-primary)', padding: '20px 20px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
  {/* title + action button + optional search bar */}
</div>
```

### 5. Bottom-sheet modal pattern
- Overlay: `position: fixed, inset: 0, zIndex: 200, background: rgba(30,20,10,0.55)`
- Sheet: `borderRadius: 20px 20px 0 0`, `maxHeight: 92svh`, flex column
- Dark header with drag handle (36×4px pill)
- Scrollable body: `flex: 1, overflowY: auto`
- Sticky footer with Cancel + Primary action buttons
- All non-submit buttons: `type="button"` — mandatory to prevent accidental form submit

### 6. Form draft pattern (for multi-item forms)
When a form collects a list of items (e.g. GSTINs, line items), use a single draft object:
```ts
const [draft, setDraft] = useState<DraftType>({ ...EMPTY_DRAFT })
// on field change:
setDraft(d => ({ ...d, field: value }))
// on commit (+ button):
setList(prev => [...prev, { ...draft }])
setDraft({ ...EMPTY_DRAFT })
```
Do NOT use separate state variables per field — causes race conditions and stale captures on click.

***

## AppShell Layout

```
┌──────────────────────────────┐
│  Scrollable content area       │  ← flex: 1, overflowY: auto
│  paddingBottom: 64px           │  ← reserves space for nav
│                                │
│  <ClientsPage /> or            │
│  <VehiclesPage /> or           │
│  <SettingsPage />              │
└──────────────────────────────┘
┌──────────────────────────────┐
│  Bottom Tab Bar (fixed)        │  ← position: fixed, bottom: 0
│  height: 64px, zIndex: 100     │
│  Clients | Vehicles | Settings │
└──────────────────────────────┘
```

***

## Supabase Rules (learned from Settings + Clients + Vehicles builds)

1. **RLS alone is not enough** — always add explicit `GRANT SELECT, INSERT, UPDATE ON table TO authenticated`
2. **Sequence GRANTs required** — `GRANT USAGE, SELECT ON SEQUENCE table_id_seq TO authenticated` — or inserts fail
3. **Upsert + composite unique** — always pass `{ onConflict: 'col1,col2' }` when upserting into tables with non-PK unique constraints, or the upsert silently no-ops
4. **Single-row tables** — use `upsert` with a fixed `id` (e.g. `id: 1`) and `{ onConflict: 'id' }`
5. **Soft delete** — use `is_active = false` rather than hard DELETE for any master data referenced by invoices (clients, bank accounts, SAC codes, vehicles). Hard delete would break invoice history FK references.
6. **Supabase CLI must run from repo root** — always `cd` to repo root before `supabase link`, `supabase functions deploy`, etc. Never run from inside `app/`.
7. **Edge Functions location** — `supabase/functions/<function-name>/index.ts` at repo root. Never inside `app/`.
