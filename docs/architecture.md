# Architecture

> Updated whenever a new module is added or the structure changes.

***

## Overview

Mobile-first PWA (React + Vite) — Supabase backend (Postgres + Auth + Storage + Edge Functions).

- **Frontend:** React 19, TypeScript, Vite, inline CSS + CSS variables (no Tailwind on UI components)
- **Backend:** Supabase (Postgres, Auth, RLS, Storage, Edge Functions for invoice numbering + AI parsing + AI description)
- **Hosting:** Cloudflare Pages (auto-deploy from `main`, build root: `app/`, build command: `npm run build`, output: `dist/`)
- **PWA:** Manual `manifest.json` + handcrafted `sw.js` — cache-first for static shell + Vite hashed assets; network-only for all Supabase calls. Registered via `registerSW.ts` called from `main.tsx`.
- **SPA routing (Cloudflare):** `app/public/_redirects` — `/* /index.html 200` catches all client-side routes
- **PDF generation:** `@react-pdf/renderer` v4 (vector PDFs, JSX layout, embedded TTF fonts)
- **OCR:** Tesseract.js (in-browser, work order PDF text extraction)
- **AI parsing:** OpenAI / Gemini via Supabase Edge Function (`parse-work-order`) — API key protected server-side
- **AI description:** Gemini via Supabase Edge Function (`generate-invoice-description`) — rental-aware prompt
- **Fonts:** Inter (body weights 400/500/600/700) + Lora (headings 400/700) — embedded as TTF in PDF via `cdn.jsdelivr.net/fontsource/fonts/`

> ⚠️ `@react-pdf/renderer` cannot use Tailwind or CSS variables — all PDF styles are `StyleSheet.create()` objects. This is PDF-only and does NOT affect the app UI styling rules.

***

## PWA Icon Requirements

| File | Size | Format | Purpose |
|---|---|---|---|
| `app/public/icons/icon-192.png` | 192×192 | PNG | Android Chrome home screen, PWA install prompt |
| `app/public/icons/icon-512.png` | 512×512 | PNG | Android splash screen, high-res displays |
| `app/public/apple-touch-icon.png` | 180×180 | PNG | **iOS Safari** — home screen icon when added via "Add to Home Screen" |
| `app/public/favicon.svg` | — | SVG | Desktop browser tabs only (SVG not used by iOS) |

> ⚠️ `icon-192.png` is committed. `icon-512.png` and `apple-touch-icon.png` must be added manually (rasterised from the app logo). iOS ignores SVG for home screen icons — PNG is mandatory.

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
      005_projects_and_work_orders.sql
      006_rental_billing.sql    ← Rental billing tables + line_item_billing_type column
      007_invoices_pdf_url.sql  ← Adds pdf_url column to invoices + Storage RLS policies
      008_dashboard_ignores.sql ← dashboard_ignores table for unbilled vehicle ignore feature
    functions/                  ← Edge Functions deployed via Supabase CLI from repo root
      generate-invoice-number/
        index.ts
      parse-work-order/
        index.ts
      generate-invoice-description/
        index.ts                ← Rental-aware AI description prompt (no per-day rate language)
  app/                          ← React frontend ONLY — no supabase folder here
    public/
      manifest.json             ← PWA Web App Manifest
      sw.js                     ← Service Worker (manual, cache-first shell strategy)
      _redirects                ← Cloudflare Pages SPA routing fix
      favicon.svg               ← Desktop browser tab icon
      apple-touch-icon.png      ← iOS home screen icon (180×180 PNG) ⚠️ ADD MANUALLY
      icons/
        icon-192.png            ← PWA icon 192×192 PNG ✅
        icon-512.png            ← PWA icon 512×512 PNG ⚠️ ADD MANUALLY
    src/
      registerSW.ts             ← Service worker registration (called from main.tsx)
      db/
        supabaseClient.ts       — typed Supabase client singleton
        types.ts                — all table row types + Database interface
        settingsDb.ts           — Settings, BankAccounts, SacCodes DB helpers
        clientsDb.ts            — Clients, ClientGstins DB helpers
        vehiclesDb.ts           — Vehicles DB helpers
        invoiceNumberingDb.ts   — generateInvoiceNumber() — calls Edge Function
        projectsDb.ts           — Projects DB helpers
        workOrdersDb.ts         — WorkOrders + WorkOrderItems DB helpers + computeWOStatus()
        invoicesDb.ts           — Invoices CRUD + saveDraftInvoice() + finalizeInvoice() (quantity + rental paths)
        invoicePdfDb.ts         — uploadInvoicePdf() (Supabase Storage upload) + getInvoiceDownloadUrl() (signed URL)
        dashboardDb.ts          — fetchKpis, fetchUnbilledVehicles, fetchVehicleRevenue, fetchWoFlags, fetchMonthlyTrend, ignore/unignore helpers
        index.ts                — re-exports all DB modules
      ui/
        LoginScreen.tsx
        AppShell.tsx            — 7-tab bar (Home | Clients | Vehicles | Work Orders | Projects | Invoices | Settings)
        dashboard/
          DashboardPage.tsx     — sticky header, unbilled alert, KPI strip, vehicle revenue chart, WO flags, 6-month billing trend chart
        settings/
          _components.tsx       — shared UI primitives (REUSE IN ALL MODULES)
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
        projects/
          ProjectsPage.tsx
          ProjectCard.tsx
          ProjectFormModal.tsx
        workorders/
          WorkOrdersPage.tsx
          WorkOrderCard.tsx
          WorkOrderFormModal.tsx    — handles both manual entry AND AI-prefill mode
          WorkOrderDetailSheet.tsx
        invoices/
          InvoicesPage.tsx
          InvoiceWizard.tsx         — 4-section wizard orchestrator
          WizardNav.tsx
          useInvoiceDraft.ts        — central wizard state hook
          Section1Header.tsx
          Section2Items.tsx         — billing mode selector + rental sub-form + distribution panel
          Section3Description.tsx   — vehicle summary (rental) or multi-select (quantity) + AI description
          Section4Review.tsx
          InvoiceActions.tsx        — reusable PDF action button (View/Download); hides on draft invoices
          pdf/
            InvoicePdf.tsx          — @react-pdf/renderer document, A4 portrait, full 11-section layout
            invoicePayloadTypes.ts  — TypeScript interfaces for PDF data (InvoicePayload + sub-types)
            buildInvoicePayload.ts  — async data assembler: invoice + FK joins + settings → InvoicePayload
            pdfUtils.ts             — formatCurrency(), formatDate(), toWords() (Indian place-value)
            InvoicePreviewModal.tsx — full-screen preview modal, download + Web Share API + Storage upload
  docs/
    progress.md
    architecture.md
    design-decisions.md
    changelog.md
  PRD.md
```

> ⚠️ **IMPORTANT — Supabase CLI rule:** Always `cd` to the **repo root** before running any
> `supabase` CLI commands (`supabase link`, `supabase functions deploy`, etc.).
> Never run them from inside `app/`.

***

## Supabase Storage Buckets

| Bucket name | Visibility | Purpose |
|---|---|---|
| `work-orders` | Private | Uploaded work order PDFs — stored after OCR + AI parse |
| `invoices` | Private | Generated invoice PDFs — signed-URL access via `getInvoiceDownloadUrl()` |

> ⚠️ Both buckets were created manually on 2026-05-24 and must exist before any upload code is run.
> The `invoices` bucket requires RLS policies from migration `007_invoices_pdf_url.sql` to allow authenticated uploads.

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
| applicable_billing_type | TEXT NOT NULL | `'quantity'` / `'rental'` / `'both'` — filters SAC dropdown per billing type in Section 1 |

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

### `projects`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| name | TEXT NOT NULL | short label e.g. "RSV LC-14 ROB" |
| full_subject | TEXT | full reference text from work order |
| site_location | TEXT | e.g. "Vijayawada–Gudivada Section" |
| client_id | BIGINT FK → clients | nullable — optional link |
| place_of_supply | TEXT NOT NULL | state name |
| state_code | TEXT NOT NULL | determines intrastate vs interstate GST |
| is_active | BOOLEAN NOT NULL | soft-delete |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

### `work_orders`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| wo_reference | TEXT | e.g. "LC-14", "LC-150" — NOT `wo_number` (deviation from PRD schema) |
| client_id | BIGINT FK → clients | nullable |
| project_id | BIGINT FK → projects | nullable |
| subject | TEXT NOT NULL | full subject from the WO document |
| issue_date | DATE NOT NULL | |
| duration_months | INTEGER | e.g. 15 |
| valid_from | DATE | = issue_date at save time |
| valid_to | DATE | = issue_date + duration_months at save time |
| total_value | NUMERIC | total contract value |
| rates_firm | BOOLEAN NOT NULL | default TRUE — from WO terms |
| tds_applicable | BOOLEAN NOT NULL | default TRUE |
| billing_type | TEXT NOT NULL | `monthly_ra` / `milestone` / `adhoc` |
| original_pdf_url | TEXT | Supabase Storage URL — set after PDF upload (Part 2) |
| extracted_text | TEXT | raw OCR output — set after Part 2 |
| status | TEXT NOT NULL | `active` / `expiring_soon` / `expired` / `closed` — display value computed client-side via `computeWOStatus()` |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

> ⚠️ `status` column in DB is only written by `closeWorkOrder()`. For display, always call `computeWOStatus(wo)` after fetching — it returns live status based on `valid_to` vs today.

### `work_order_items`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| work_order_id | BIGINT FK → work_orders | ON DELETE CASCADE |
| sl_no | INTEGER | line number |
| description | TEXT NOT NULL | |
| sub_work_ref | TEXT | e.g. "SW:1" — not in PRD schema, added from real WO samples |
| unit | TEXT | e.g. MT, CUM, Month |
| contracted_qty | NUMERIC | |
| rate | NUMERIC NOT NULL | |
| amount | NUMERIC | contracted_qty × rate |
| cumulative_billed_qty | NUMERIC NOT NULL | default 0 — updated on each invoice finalize |
| created_at | TIMESTAMPTZ | |

> ⚠️ Items use **replace-on-save**: `upsertWorkOrderItems()` deletes all existing items for the WO then re-inserts. Do NOT attempt differential updates.

### `invoices`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| invoice_number | TEXT UNIQUE | assigned at finalize only (e.g. `SVC/25-26/001`) |
| client_id | BIGINT FK → clients | |
| client_gstin_id | BIGINT FK → client_gstins | |
| work_order_id | BIGINT FK → work_orders | nullable |
| sac_id | BIGINT FK → sac_codes | |
| bank_account_id | BIGINT FK → bank_accounts | |
| invoice_date | DATE NOT NULL | |
| billing_from | DATE NOT NULL | |
| billing_to | DATE NOT NULL | |
| tax_mode | TEXT NOT NULL | `cgst_sgst` or `igst` |
| reverse_charge | BOOLEAN NOT NULL | |
| total_taxable | NUMERIC NOT NULL | |
| cgst_amount | NUMERIC | |
| sgst_amount | NUMERIC | |
| igst_amount | NUMERIC | |
| total_invoice_amount | NUMERIC NOT NULL | |
| tds_amount | NUMERIC | |
| net_receivable | NUMERIC | |
| description | TEXT | AI-generated or user-edited |
| status | TEXT NOT NULL | `draft` / `final` / `cancelled` |
| **line_item_billing_type** | **TEXT NOT NULL DEFAULT 'quantity'** | **`'quantity'` or `'rental'` — drives Section 2 UI and PDF layout path.** |
| **pdf_url** | **TEXT** | **Supabase Storage URL of the generated PDF — set by `uploadInvoicePdf()` after first preview/download.** |
| created_at | TIMESTAMPTZ | |

### `invoice_line_items` (quantity invoices only)
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| invoice_id | BIGINT FK → invoices | ON DELETE CASCADE |
| work_order_item_id | BIGINT FK → work_order_items | nullable |
| sl_no | INTEGER | |
| description | TEXT NOT NULL | |
| unit | TEXT | |
| qty | NUMERIC NOT NULL | |
| rate | NUMERIC NOT NULL | |
| taxable_value | NUMERIC NOT NULL | qty × rate |

### Migration 006 — Rental Billing

| Table / Change | Purpose |
|---|---|
| `invoice_rental_items` | One row per vehicle per rental invoice. |
| `invoice_item_distribution` | Maps rental invoice total to WO items for `cumulative_billed_qty` tracking. |
| `vehicle_billing_ledger` | Analytics ledger — one row per vehicle per invoice finalized. |
| `invoices.line_item_billing_type` | `'quantity'` or `'rental'`. Drives Section 2 wizard UI and PDF layout path. |
| `sac_codes.applicable_billing_type` | Filters SAC code dropdown in Section 1 based on billing type. |

### Migration 007 — Invoice PDF URL

| Change | Purpose |
|---|---|
| `invoices.pdf_url TEXT` | Stores Supabase Storage URL of generated PDF. |
| Storage RLS policies | INSERT / SELECT / UPDATE on `invoices` bucket for authenticated users. |

### Migration 008 — Dashboard Ignores

| Change | Purpose |
|---|---|
| `dashboard_ignores` table | Tracks vehicle-months the operator has explicitly marked as not needing a billing alert. |

***

## UI Patterns (mandatory for all modules)

### 1. Styling
- **Always** use inline CSS with CSS variables from `index.css`
- **Never** use Tailwind utility classes on UI components — it breaks design consistency
- CSS variables: `--color-primary`, `--color-bg`, `--color-accent`, `--color-surface`, `--color-surface-offset`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-text-faint`, `--color-success`, `--color-success-highlight`, `--color-warning`, `--color-warning-highlight`, `--color-error`, `--color-error-highlight`, `--color-info`, `--color-info-highlight`
- Fonts: `Playfair Display` for headings (h1–h3), `Work Sans` for body/inputs
- **PDF components only:** Use `StyleSheet.create()` from `@react-pdf/renderer` — CSS variables do not apply here

### 2. Shared primitives — import from `settings/_components.tsx`
```ts
import { Field, PrimaryButton, cardStyle, sectionTitleStyle, inputStyle, labelStyle } from '../settings/_components'
```
Never redeclare these. Always import.

### 3. Page root
- Root div: `style={{ minHeight: '100%', background: 'var(--color-bg)' }}`
- Do NOT use `min-height: 100svh` — AppShell handles full height

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
- All non-submit buttons: `type="button"` — mandatory

### 6. Form draft pattern (for multi-item forms)
```ts
const [draft, setDraft] = useState<DraftType>({ ...EMPTY_DRAFT })
setDraft(d => ({ ...d, field: value }))
setList(prev => [...prev, { ...draft }])
setDraft({ ...EMPTY_DRAFT })
```

### 7. Select / dropdown pattern
For selects (client picker, project picker, billing type), use a plain `<select>` with the `inputStyle` object.

### 8. Toggle / switch pattern
For boolean fields (rates_firm, tds_applicable), use the pill-toggle pattern established in `WorkOrderFormModal`.

***

## AppShell Layout (7 tabs)

```
┌──────────────────────────────┐
│  Scrollable content area       │  ← flex: 1, overflowY: auto
│  paddingBottom: 64px           │
│                                │
│  <DashboardPage />             │
│  <ClientsPage />               │
│  <VehiclesPage />              │
│  <WorkOrdersPage />            │
│  <ProjectsPage />              │
│  <InvoicesPage />              │
│  <SettingsPage />              │
└──────────────────────────────┘
┌──────────────────────────────┐
│  Bottom Tab Bar (fixed)        │  ← position: fixed, bottom: 0, height: 64px
│  🏠 Home                      │  font: 10px Work Sans
│  👤 Clients                   │  icon: 18px emoji
│  🚛 Vehicles                  │
│  📋 Work Orders               │
│  📁 Projects                  │
│  🧾 Invoices                  │
│  ⚙️ Settings                  │
└──────────────────────────────┘
```

***

## Supabase Rules (accumulated from all sessions)

1. **RLS alone is not enough** — always add explicit `GRANT SELECT, INSERT, UPDATE ON table TO authenticated`
2. **Sequence GRANTs required** — `GRANT USAGE, SELECT ON SEQUENCE table_id_seq TO authenticated` — or inserts fail
3. **Upsert + composite unique** — always pass `{ onConflict: 'col1,col2' }` for non-PK unique constraints
4. **Single-row tables** — use `upsert` with a fixed `id: 1` and `{ onConflict: 'id' }`
5. **Soft delete** — use `is_active = false` for master data referenced by invoices
6. **Supabase CLI must run from repo root** — never from inside `app/`
7. **Edge Functions location** — `supabase/functions/<function-name>/index.ts` at repo root
8. **Edge Function env vars** — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` auto-injected; only use `supabase secrets set` for custom third-party keys
9. **JOIN pattern in DB helpers** — use `.select('*, related_table(col)')` for FK joins
10. **Delete-before-insert for child lists** — for 1:many relationships where the user edits the full list, delete all children then re-insert rather than diffing.
11. **`NUMERIC` division in SQL for rental billing** — never use integer division for `(monthly_rent / 30) × num_days`
12. **`@react-pdf/renderer` fonts must be TTF** — woff2 is not supported.
