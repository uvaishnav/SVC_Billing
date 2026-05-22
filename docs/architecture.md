
# Architecture — GST Invoice & Work Order Billing App (V3)

> Updated as the project evolves. If something here contradicts the code, the code wins — update this file.
> **Version:** V3 Initial | **Last Updated:** May 2026

---

## Project Overview

- **Project name:** Sri Vaishnav Constructions — GST Billing & Work Order App
- **What it does:** Generates GST-compliant PDF tax invoices, manages work orders and vehicles, and provides an operational billing dashboard for a construction & equipment-rental business.
- **App type:** Progressive Web App (PWA) — mobile-first, installs via Safari on iPhone, full dashboard on desktop
- **Primary user:** Uppalapati Surekha, Sri Vaishnav Constructions, Godavarru, Andhra Pradesh

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **UI Framework** | React (via Vite) | Component model, routing, ecosystem |
| **Language** | TypeScript | Type safety across forms, DB models, PDFs |
| **PWA Shell** | Vite PWA Plugin + Workbox | iPhone home-screen install, offline caching, no App Store |
| **Styling** | Tailwind CSS | Mobile-first, brand tokens via CSS variables |
| **Database** | Supabase (PostgreSQL) | Cloud-hosted, real-time sync across all devices |
| **Auth** | Supabase Auth | Secure login for family/authorised users only |
| **File Storage** | Supabase Storage | PDF invoices + uploaded work order PDFs |
| **Offline Cache** | IndexedDB via Dexie.js | Local drafts and data cache when offline |
| **PDF Generation** | jsPDF + html2canvas | In-browser branded PDF generation, no server required |
| **OCR** | Tesseract.js | In-browser text extraction from uploaded work order PDFs |
| **AI Integration** | OpenAI / Gemini API (via Supabase Edge Function) | Invoice description generation and improvement — key must NOT be in browser |
| **Server-side Logic** | Supabase Edge Functions | Central invoice number generation, audit logging, AI proxy |
| **Hosting** | Vercel | Free tier, auto-deploys from GitHub |
| **Testing** | Vitest + React Testing Library | Unit tests for core logic and UI components |

---

## Repository / Folder Structure

```
project-root/
├── src/
│   ├── core/              # Domain logic — business rules, validations, calculations
│   ├── db/                # Supabase client, schema types, query helpers
│   ├── ui/                # Screens, layouts, and components
│   │   ├── dashboard/
│   │   ├── invoice/       # New Bill wizard + Invoice History
│   │   ├── work-orders/
│   │   ├── clients/
│   │   ├── vehicles/
│   │   ├── projects/
│   │   └── settings/
│   ├── pdf/               # PDF template, layout, and generation logic
│   ├── integrations/      # AI assistant, OCR wrapper, Supabase Storage helpers
│   └── offline/           # Dexie.js schema, sync queue, connectivity indicator
├── supabase/
│   ├── migrations/        # SQL migration files
│   └── functions/         # Edge Functions (invoice-number, ai-proxy, audit-log)
├── public/                # PWA manifest, icons, service worker
├── docs/                  # This file and other documentation
└── scripts/               # One-off helpers (seed data, exports)
```

---

## Module Responsibilities

### `core/`
- **What lives here:** Business rules and pure computation — GST mode detection (intrastate vs interstate), invoice number generation logic, TDS calculation, work-order validity checks, quantity tracking, rate-override logic, description validation
- **What it must NOT do:** Touch Supabase directly, render UI, or expose API keys
- **Key concepts:**
  - `InvoiceCalculator` — taxable value, CGST/SGST/IGST, TDS, net payable
  - `GSTModeResolver` — auto-detects intrastate/interstate from Place of Supply vs supplier state (AP, code 37)
  - `InvoiceNumberBuilder` — constructs `{PREFIX}/{FY}/{SEQ}` format (e.g. `SVC/26-27/001`)
  - `WorkOrderValidator` — checks billing period against `valid_from`/`valid_to`, quantity headroom
  - `DescriptionValidator` — warns if description lacks work type, period, vehicles, or WO reference

### `db/`
- **What lives here:** Supabase client instance, TypeScript types auto-generated from schema, query helper functions per domain entity
- **Main tables:**
  - `settings` — business profile, invoice numbering config, GST defaults
  - `clients` — name, address, multiple GSTINs by state
  - `vehicles` — reg number, type, capacity, unit, default rate
  - `projects` — linked to client, place of supply
  - `work_orders` — linked to client + project, validity dates, PDF URL
  - `work_order_items` — line items with contracted qty, rate, cumulative billed qty
  - `invoices` — full invoice header with tax mode, status, payment tracking
  - `invoice_line_items` — per-line item with SAC, qty, rate, tax breakdown, override flags
  - `invoice_vehicles` — junction: invoice ↔ vehicle
- **Migration strategy:** All changes via numbered SQL files in `supabase/migrations/`. Never alter prod schema manually. Row-Level Security (RLS) enabled on all tables.

### `ui/`
- **What lives here:** React screens, layouts (mobile bottom-tab vs desktop sidebar), shared components
- **Screens list:**
  1. Dashboard (KPI cards, charts, flags, calendar)
  2. New Bill Wizard (8 steps: Header → WO Link → Items → Vehicles → Description → Values → Preview → Generate)
  3. Invoice History (filter, view, edit, duplicate, cancel, share)
  4. Work Orders (upload, OCR review, statuses, utilization)
  5. Clients Master
  6. Vehicles Master
  7. Projects / Work References
  8. Settings (business details, bank accounts, numbering, PDF style)
  9. AI Description Assistant (inline within step 5 of wizard)
  10. Flags / Alerts Center
- **Navigation:** Bottom tab bar on mobile (< 768px); collapsible sidebar on desktop (≥ 1024px)
- **Component naming convention:** PascalCase, domain-prefixed — e.g. `InvoiceWizardStep`, `WorkOrderCard`, `VehicleChip`, `DashboardKPICard`
- **Mobile rules:** All tap targets ≥ 44×44px; no hover-only interactions; wizard is one task per screen

### `pdf/`
- **What lives here:** Invoice PDF layout definition, brand color constants, section renderers (header, line items table, totals, bank details, signature), file-naming logic
- **Template approach:** HTML template rendered in-browser via `html2canvas` → `jsPDF`. Two visual variants: **Intrastate** (gold table headers) and **Interstate** (blue-tinted table headers). Both share the deep brown (`#3B2A1F`) header and cream (`#F5F1E8`) base.
- **File naming:** `{PREFIX}_{FY}_{SeqNo}_{ClientShortName}_{YYYYMM}.pdf` — e.g. `SVC_26-27_001_RSV_202604.pdf`
- **How generation is triggered:** Step 8 of invoice wizard → `core/InvoiceCalculator` finalises values → `pdf/InvoiceRenderer` builds HTML → PDF blob generated → uploaded to Supabase Storage → URL saved on `invoices.pdf_storage_url`
- **Edit-and-replace:** Regenerating a final invoice overwrites the existing PDF in Storage; `last_modified_at` and `modification_reason` are updated; `created_at` and `invoice_number` remain unchanged

### `integrations/`
- **What lives here:** Wrappers for external services — Supabase Storage helper, AI description service, Tesseract.js OCR wrapper
- **Each integration:**
  - `aiDescriptionService` — calls Supabase Edge Function `/ai-proxy` which holds the OpenAI/Gemini key server-side. Three modes: A (auto-generate from structured data), B (improve rough text), C (rewrite suggestions)
  - `ocrService` — wraps Tesseract.js to extract raw text from uploaded work-order PDFs; output fed to AI for structured field parsing
  - `storageService` — upload/download/replace files in Supabase Storage buckets (`invoices/`, `work-orders/`)

### `offline/`
- **What lives here:** Dexie.js (IndexedDB) schema mirroring key tables, a sync queue for offline-created drafts, connectivity state hook
- **Offline behaviour:** Recently viewed invoices, clients, vehicles, work orders cached locally. New invoices can be drafted offline and queued. On reconnect, queued changes sync to Supabase automatically. UI shows a connectivity indicator: 🟢 Online / 🟡 Syncing / ⚫ Offline.

### `supabase/functions/`
- **`invoice-number`** — atomically generates the next sequence number for a given FY prefix; prevents duplicate invoice numbers across simultaneous devices
- **`ai-proxy`** — receives description request, calls OpenAI/Gemini API with business context, returns generated text; AI API key never exposed in browser
- **`audit-log`** — records edit events, rate overrides, GST mode overrides with timestamps and user context

---

## Data Flow

### Standard Invoice Creation
```
[Mobile Wizard Step 1–8]
  → [ui/invoice/InvoiceWizard]
  → [core/InvoiceCalculator, WorkOrderValidator, GSTModeResolver]
  → [supabase/functions/invoice-number]  ← atomic sequence
  → [db/ — insert invoices, invoice_line_items, invoice_vehicles]
  → [pdf/InvoiceRenderer — generate PDF blob]
  → [integrations/storageService — upload to Supabase Storage]
  → [db/ — update invoices.pdf_storage_url, set status = 'final']
  → [ui/ — show success + share options]
```

### Work Order Upload & OCR
```
[User uploads PDF]
  → [integrations/ocrService — Tesseract.js extracts raw text]
  → [integrations/aiDescriptionService — parse structured fields]
  → [ui/work-orders/ExtractionReviewScreen — user corrects fields]
  → [db/ — insert work_orders + work_order_items]
  → [integrations/storageService — store original PDF]
```

### Offline Draft Sync
```
[User creates draft offline]
  → [offline/DexieDB — queued locally]
  → [connectivity restored]
  → [offline/syncQueue — push to Supabase]
  → [ui/ — status updated to synced]
```

---

## GST & Invoice Rules (Key Constraints)

- **GST mode:** Auto-detected — supplier is always Andhra Pradesh (code 37). If Place of Supply = AP → Intrastate (CGST 9% + SGST 9%); else Interstate (IGST 18%). Manual override is allowed but logged.
- **Invoice numbering:** Format `{PREFIX}/{FY}/{SEQ}` — FY runs April–March; sequence resets to `001` on April 1; generated server-side via Edge Function to guarantee uniqueness
- **SAC code:** Default `997319`; editable per invoice
- **TDS:** Default 2%, calculated on taxable value only (not GST-inclusive amount)
- **Invoice statuses:** `draft` → `final` → `cancelled` / `superseded`. Final invoices are editable with warning + audit log. Cancelled/superseded are read-only.
- **Rate override:** Allowed, but triggers a warning quoting work-order firm-rate clause; reason logged on `invoice_line_items.override_reason`
- **Work-order coverage:** If no valid WO exists for billing period, show warning banner; tag invoice with `work_order_coverage = 'missing'`; do not block user

---

## Brand & Design Tokens

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#3B2A1F` | Nav, headings, PDF header background |
| `--color-bg` | `#F5F1E8` | Page background, PDF base |
| `--color-accent` | `#C8A96A` | Buttons, CTAs, intrastate table headers |
| `--color-info` | `#2A5F8A` | Interstate table headers, info badges |
| `--color-success` | `#5A7A2E` | Paid, active WO |
| `--color-warning` | `#A05C1A` | Expiring WO, rate override, draft |
| `--color-error` | `#8B2E2E` | No WO coverage, overdue |

- **Headings font:** Playfair Display (600–700)
- **Body / UI font:** Work Sans (400–600), tabular-nums for all numeric data
- Dark mode uses deep brown `#1C1510` as page background with cream text `#F0EBE0`

---

## Layer Boundaries

| Layer | Can call | Cannot call |
|---|---|---|
| `ui/` | `core/`, `integrations/`, `offline/` | `db/` directly |
| `core/` | `db/` (read-only helpers) | `ui/`, `integrations/` |
| `integrations/` | `core/` | `db/` directly |
| `db/` | Supabase client only | anything else |
| `supabase/functions/` | Supabase DB, external APIs | `ui/`, `core/` |

---

## Phased Implementation Plan

| Phase | Scope |
|---|---|
| **Phase 1 — Core MVP** | PWA setup, Supabase project, Vercel deploy, Settings/Clients/Vehicles, invoice numbering, PDF generation (both intrastate & interstate), invoice history, edit-and-replace |
| **Phase 2 — Work Order Intelligence** | WO upload, OCR extraction, WO-linked billing, quantity/rate warnings, coverage indicator |
| **Phase 3 — AI Assistance** | AI description modes A/B/C via Edge Function proxy |
| **Phase 4 — Dashboard & Insights** | KPI cards, charts, WO utilization, vehicle analytics, FY toggle, billing calendar, flags center |
| **Phase 5 — Advanced** | Payment tracking, WhatsApp sharing, credit/debit note, offline sync robustness, audit report screen |

---

## Current Known Gaps / Open Questions

- [ ] Final decision on AI provider: OpenAI (GPT-4o) vs Google Gemini — to be confirmed before Phase 3
- [ ] OCR accuracy on handwritten or low-quality work order scans — fallback to full manual entry if confidence is low
- [ ] Offline conflict resolution strategy: if same invoice is edited on two devices simultaneously while offline
- [ ] WhatsApp share mechanism on iOS PWA — Web Share API supported on Safari; needs testing
- [ ] Credit note / debit note schema — deferred to Phase 5, schema not yet designed
- [ ] Multi-user / role-based access — deferred; current design assumes single authorized user
- [ ] Testing strategy for Edge Functions — not yet defined
