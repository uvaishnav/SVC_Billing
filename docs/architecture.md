# Architecture

> Updated whenever a new module is added or the structure changes.

***

## Overview

Mobile-first PWA (React + Vite) — Supabase backend (Postgres + Auth + Storage + Edge Functions).

- **Frontend:** React 18, TypeScript, Vite, inline CSS + CSS variables (no Tailwind on UI components)
- **Backend:** Supabase (Postgres, Auth, RLS, Storage, Edge Functions for invoice numbering + AI parsing)
- **Hosting:** Vercel (auto-deploy from `main`)
- **PDF generation:** jsPDF + html2canvas (in-browser)
- **OCR:** Tesseract.js (in-browser, work order PDF text extraction)
- **AI parsing:** OpenAI / Gemini via Supabase Edge Function (`parse-work-order`) — API key protected server-side
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
      005_projects_and_work_orders.sql
      006_rental_billing.sql    ← Rental billing tables + line_item_billing_type column
    functions/                  ← Edge Functions deployed via Supabase CLI from repo root
      generate-invoice-number/
        index.ts
      parse-work-order/
        index.ts
      generate-invoice-description/
        index.ts                ← Rental-aware AI description prompt (no per-day rate language)
  app/                          ← React frontend ONLY — no supabase folder here
    src/
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
        index.ts                — re-exports all DB modules
      ui/
        LoginScreen.tsx
        AppShell.tsx            — 5-tab bar (Clients | Vehicles | Work Orders | Projects | Settings)
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
| `invoices` | Private | Generated invoice PDFs — to be created when invoice module is built |

> ⚠️ Both buckets must exist before any upload code is run. `work-orders` was created manually on 2026-05-24.

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
| **line_item_billing_type** | **TEXT NOT NULL DEFAULT 'quantity'** | **`'quantity'` or `'rental'` — drives Section 2 UI and PDF layout path. Single authoritative flag, never inferred from child tables.** |
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

### Migration 006 — Rental Billing (`supabase/migrations/006_rental_billing.sql`)

| Table / Change | Purpose |
|---|---|
| `invoice_rental_items` | One row per vehicle per rental invoice. Stores `billing_mode` (`full_month` / `partial_days`), `num_days`, `monthly_rent` (snapshot), `subtotal` (computed). SUM of subtotals = `invoices.total_taxable`. |
| `invoice_item_distribution` | Maps rental invoice total to individual WO items for `cumulative_billed_qty` tracking. Per-row: `work_order_item_id`, `allocation_pct`, `allocated_amount`. Rental invoices only. |
| `vehicle_billing_ledger` | Analytics ledger — one row per vehicle per invoice finalized. Written on finalize, deleted on cancel. Used for future "revenue per vehicle" dashboard. Never edited by the user. |
| `invoices.line_item_billing_type` | New column (`TEXT NOT NULL DEFAULT 'quantity'`). Values: `'quantity'` or `'rental'`. Drives Section 2 wizard UI and PDF layout path. Single authoritative flag — not inferred from child tables. |
| `sac_codes.applicable_billing_type` | New column (`TEXT NOT NULL DEFAULT 'both'`). Values: `'quantity'`, `'rental'`, `'both'`. Filters SAC code dropdown in Section 1 based on billing type selected. |

#### `invoice_rental_items`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| invoice_id | BIGINT FK → invoices | ON DELETE CASCADE |
| vehicle_id | BIGINT FK → vehicles | |
| billing_mode | TEXT NOT NULL | `full_month` or `partial_days` |
| num_days | INTEGER | NULL for `full_month`; required for `partial_days` |
| monthly_rent | NUMERIC NOT NULL | snapshot of rent at invoice time |
| subtotal | NUMERIC NOT NULL | `monthly_rent` for full month; `(monthly_rent / 30) × num_days` for partial |

#### `invoice_item_distribution`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| invoice_id | BIGINT FK → invoices | ON DELETE CASCADE |
| work_order_item_id | BIGINT FK → work_order_items | |
| allocation_pct | NUMERIC NOT NULL | user-set percentage (0–100); all rows must sum to 100 at finalize |
| allocated_amount | NUMERIC NOT NULL | `total_taxable × (allocation_pct / 100)` |

> ⚠️ Distribution percentage sum = 100% is enforced in the UI (live warning + blocked submit). No DB-level CHECK constraint — allows mid-edit saves with an incomplete distribution.

#### `vehicle_billing_ledger`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| invoice_id | BIGINT FK → invoices | |
| vehicle_id | BIGINT FK → vehicles | |
| billing_period_from | DATE NOT NULL | |
| billing_period_to | DATE NOT NULL | |
| billing_mode | TEXT NOT NULL | |
| num_days | INTEGER | |
| monthly_rent | NUMERIC NOT NULL | |
| subtotal | NUMERIC NOT NULL | |
| created_at | TIMESTAMPTZ | |

> ⚠️ Analytics-only table. Never shown in UI directly. Written on `finalizeInvoice()`, deleted on `cancelInvoice()`. Used for future "revenue per vehicle" dashboard feature.

**Rental invoice data flow:**
1. User selects `billing_type = 'rental'` in Section 1 → `InvoiceDraft.line_item_billing_type = 'rental'`
2. Section 2 shows rental sub-form → writes `InvoiceRentalItemDraft[]` + `InvoiceItemDistributionDraft[]`
3. Section 3 shows read-only vehicle summary (no picker); AI description uses rental prompt (no per-day rate)
4. On finalize → `invoicesDb.finalizeInvoice()` writes `invoice_rental_items`, `invoice_item_distribution`, `vehicle_billing_ledger`; increments `cumulative_billed_qty` per WO item proportional to `allocated_amount`
5. PDF renderer checks `line_item_billing_type` → routes to rental layout (vehicle table, no qty/unit columns)

***

## UI Patterns (mandatory for all modules)

### 1. Styling
- **Always** use inline CSS with CSS variables from `index.css`
- **Never** use Tailwind utility classes on UI components — it breaks design consistency
- CSS variables: `--color-primary`, `--color-bg`, `--color-accent`, `--color-surface`, `--color-surface-offset`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-text-faint`, `--color-success`, `--color-success-highlight`, `--color-warning`, `--color-warning-highlight`, `--color-error`, `--color-error-highlight`, `--color-info`, `--color-info-highlight`
- Fonts: `Playfair Display` for headings (h1–h3), `Work Sans` for body/inputs

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
For selects (client picker, project picker, billing type), use a plain `<select>` with the `inputStyle` object:
```tsx
<select value={val} onChange={e => setVal(e.target.value)} style={{ ...inputStyle }}>
  <option value="">— placeholder —</option>
  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
</select>
```

### 8. Toggle / switch pattern
For boolean fields (rates_firm, tds_applicable), use the pill-toggle pattern established in `WorkOrderFormModal`:
```tsx
<button type="button" onClick={() => setVal(!val)}
  style={{ width: 48, height: 28, borderRadius: 14, background: val ? 'var(--color-accent)' : 'var(--color-border)', ... }}>
  <span style={{ position: 'absolute', top: 3, left: val ? 22 : 3, ... }} />
</button>
```

***

## AppShell Layout (5 tabs)

```
┌──────────────────────────────┐
│  Scrollable content area       │  ← flex: 1, overflowY: auto
│  paddingBottom: 64px           │
│                                │
│  <ClientsPage />               │
│  <VehiclesPage />              │
│  <WorkOrdersPage />            │
│  <ProjectsPage />              │
│  <SettingsPage />              │
└──────────────────────────────┘
┌──────────────────────────────┐
│  Bottom Tab Bar (fixed)        │  ← position: fixed, bottom: 0, height: 64px
│  👤 Clients                   │  font: 10px Work Sans
│  🚛 Vehicles                  │  icon: 18px emoji
│  📋 Work Orders               │
│  📁 Projects                  │
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
8. **Edge Function env vars** — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` auto-injected; only use `supabase secrets set` for custom third-party keys (AI API keys, etc.)
9. **JOIN pattern in DB helpers** — use `.select('*, related_table(col)')` for FK joins; map result to flatten: `client_name: row.clients?.name ?? null, clients: undefined`
10. **Delete-before-insert for child lists** — for 1:many relationships where the user edits the full list (e.g. work_order_items), delete all children then re-insert rather than diffing. Simpler and safe for this use case.
11. **`NUMERIC` division in SQL for rental billing** — never use integer division for `(monthly_rent / 30) × num_days`; ensure both operands are `NUMERIC` to avoid truncation. TypeScript: use plain `number` arithmetic, never `Math.floor` on intermediate rental subtotal.
