# Changelog

> Most recent entries first. Keep the last 15 entries.

---

## [2026-06-02] — PWA + Cloudflare Deployment Prerequisites

### Added
- `app/public/manifest.json` — Web App Manifest.
  - `name: "SVC Billing"`, `short_name: "SVC Billing"`, `display: "standalone"`, `orientation: "portrait"`.
  - `theme_color` + `background_color`: `#01696f` (app's primary teal).
  - Icons: `icons/icon-192.png` (any) + `icons/icon-512.png` (any maskable).
- `app/public/sw.js` — Manual service worker.
  - **Install:** pre-caches shell assets (`/`, `/index.html`, `/manifest.json`, `/favicon.svg`, both PNGs, `apple-touch-icon.png`).
  - **Activate:** cleans up old caches by version name.
  - **Fetch strategy:** Vite `/assets/` hashed files → cache-first (safe: filename changes on each build). Navigation → network-first with `index.html` fallback (offline shell). Supabase (`supabase.co` / `supabase.io`) → always bypassed (never cached). All non-GET requests → bypassed.
- `app/public/_redirects` — Cloudflare Pages SPA routing. Single line: `/* /index.html 200`.
- `app/src/registerSW.ts` — `registerServiceWorker()` function. Registers `sw.js` at scope `/` on `window load`. Silent fail if browser lacks SW support.
- `app/public/icons/icon-192.png` — 192×192 PNG icon (PWA install prompt, Android home screen).

### Changed
- `app/index.html`:
  - Added `<link rel="manifest">`, `<meta name="apple-mobile-web-app-capable">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`, `<meta name="apple-mobile-web-app-title">`, `<link rel="apple-touch-icon">`.
  - Added `<meta name="theme-color" content="#01696f">`.
  - Updated `<title>` to `SVC Billing`.
  - Updated viewport to include `viewport-fit=cover` (needed for iPhone notch/dynamic island safe areas).
- `app/src/main.tsx` — added `import { registerServiceWorker } from './registerSW'` and `registerServiceWorker()` call after React root mount.

### Observations
- `icon-512.png` and `apple-touch-icon.png` are referenced in manifest/index.html but not yet committed — must be added manually as PNG rasters of the app logo. iOS Safari ignores SVG for home screen icons.
- The SW deliberately does NOT cache Supabase API calls. Auth tokens and data must always come from the network. Caching these would cause stale-login bugs after session expiry.
- `viewport-fit=cover` is required for the app to extend behind the iPhone notch/dynamic island. The bottom tab bar already has enough `padding-bottom` to stay above the home indicator.
- Cloudflare Pages setup: build root = `app/`, build command = `npm run build`, output = `dist`. Environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in the Cloudflare dashboard.

---

## [2026-06-01] — Dashboard / Home Tab (Phase 4)

### Added

- `supabase/migrations/008_dashboard_ignores.sql` — new `dashboard_ignores` table.
  - Columns: `vehicle_id` (FK → vehicles), `year_month` (TEXT, format `YYYY-MM`).
  - UNIQUE constraint on `(vehicle_id, year_month)` — prevents duplicate ignores.
  - RLS policy: authenticated users only.

- `app/src/db/dashboardDb.ts` — all dashboard data queries.
  - `fetchKpis()` — returns `thisMonthRevenue`, `thisFyRevenue`, `activeWoCount`, `expiringWoCount`.
  - `fetchUnbilledVehicles()` — checks active vehicles against `vehicle_billing_ledger` for current + previous month.
  - `fetchVehicleRevenue(period)` — aggregates per vehicle for current month or current FY.
  - `fetchWoFlags()` — `expiring_soon` + `near_limit` flags.
  - `fetchMonthlyTrend()` — last 6 months, zero-filled.
  - `ignoreUnbilledMonth` / `unignoreUnbilledMonth` — upsert/delete from `dashboard_ignores`.

- `app/src/ui/dashboard/DashboardPage.tsx` — full dashboard page.
- `app/src/ui/AppShell.tsx` — 🏠 Home as tab 0.

### Fixed
- `DashboardPage.tsx` — `inv.totalInvoiceAmount` → `inv.totalAmount`.
- `DashboardPage.tsx` — Restore button CSS var `--color-info` → `--color-primary`.

### Changed
- `dashboardDb.ts` — replaced `fetchRecentInvoices()` with `fetchMonthlyTrend()`.

### Observations
- `vehicle_billing_ledger` makes all dashboard queries fast — no joins needed.
- Chart.js loaded from CDN lazily on first Dashboard render.

---

## [2026-06-01] — Cancel Invoice + Edit Finalised Invoice + InvoicesPage Redesign

### Added
- `supabase/migrations/008_decrement_billed_qty_rpc.sql` — `decrement_billed_qty` RPC.
- `cancelInvoice(invoiceId)` in `invoicesDb.ts` — reverses qty + ledger, sets `status = 'cancelled'`.
- `_reverseBilledQty` + `_reverseVehicleLedger` private helpers in `invoicesDb.ts`.

### Fixed
- `InvoiceWizard.tsx` — Next button was hidden when editing a final invoice.

### Changed
- `InvoicesPage.tsx` — full redesign: teal header, FY selector, status filter pills, VOID stamp, `InvoiceCard` extracted.

---

## [2026-06-01] — Draft/Final UI Split + Draft Delete

### Added
- `deleteDraftInvoice(invoiceId)` in `invoicesDb.ts`.

### Changed
- `InvoicesPage.tsx` — split into Drafts (top) and Finalised (bottom) sections.

---

## [2026-06-01] — Invoice Identity Fix (Draft → Final same row)

### Fixed
- `saveDraftInvoice()` + `finalizeInvoice()` — accept `existingInvoiceId` to UPDATE in-place.

---

## [2026-06-01] — TDS Calculation Fixes + Invoice Rollback

### Fixed
- TDS base corrected to `total_taxable` everywhere.

---

## [2026-06-01] — PDF Layout Fixes

### Fixed
- Header overlap, logo size, description indent, gold separator row in `InvoicePdf.tsx`.

---

## [2026-05-31] — PDF Layout Fixes (Session 2) + Bug Fixes

### Fixed
- Additional PDF layout fixes. TDS always 0% bug. Invoice date auto-recalculation. PDF font CDN URLs.

---

## [2026-05-30] — PDF Invoice Generation — Part 3

### Added
- Complete `@react-pdf/renderer` pipeline: `InvoicePdf.tsx`, payload types, utilities, assembler, preview modal, actions component, PDF storage helpers, migration 007.

---

## [2026-05-28] — Invoice Wizard — Phase 3 Parts 1–2

### Added
- Migration 006, rental billing schema, Section 2 + Section 3, AI description Edge Function.

---

## [2026-05-27] — Invoice Wizard — Phase 3 Part 1

### Added
- Invoice tab, wizard shell, Section 1 Header, Section 4 Review, `invoicesDb`, `invoiceNumberingDb`.

---

## [2026-05-26] — Invoice Face Design

### Added
- Compliance-first invoice section structure locked in `design-decisions.md`.

---

## [2026-05-24] — Work Orders Module — Part 2 (OCR + AI Parse)

### Added
- OCR + AI-prefill mode, `parse-work-order` Edge Function, Tesseract.js.
