# Changelog

> Most recent entries first. Keep the last 15 entries.

---

## [2026-06-02] — iOS PWA Premium Overhaul (PR #19)

### Added
- **Skeleton shimmer loading** on all major pages (`CardSkeleton`, `InvoiceListSkeleton`, `WOListSkeleton`, `SettingsSkeleton`) — shimmer replaces plain "Loading…" text.
- **`pdfjs-dist`** canvas-based PDF viewer — replaces broken `<iframe src="blob:">` pattern that triggered iOS Safari to open PDFs externally. Each page renders inline to `<canvas>`.
- **`.skeleton` CSS class** with 1.4s animated gradient shimmer.
- **`.tab-page` CSS animation** — subtle `translateY(6px) → 0` + fade on tab switch.
- **`.card-tap` CSS class** — `scale(0.985)` press feedback for tappable cards.
- **`touch-action: manipulation` globally** — removes iOS 300ms tap delay without `fastclick`.

### Changed
- **AppShell**: 7 tabs → 5 tabs (Home, Invoices, Clients, Work Orders, Settings). Vehicles + Projects removed from nav bar (data intact in DB).
- **Icons**: all emoji icons replaced with Lucide React SVG icons (`LayoutDashboard`, `FileText`, `Users`, `ClipboardList`, `Settings`, `Plus`, `FileDown`, `X`, `Download`, `Share2`).
- **Active tab indicator**: gold-tinted pill behind active icon instead of coloured text only. `strokeWidth` 2.2 active / 1.8 inactive.
- **Typography**: `DM Serif Display` replaces `Playfair Display` globally — 25 files updated via `sed`.
- **Google Fonts**: `@import` in `index.css` updated from Playfair Display + Work Sans → DM Serif Display + Work Sans.
- **Dark mode**: removed entirely — `@media (prefers-color-scheme: dark)` block deleted. App stays premium warm light in all iOS appearance settings.
- **LoginScreen**: premium card layout, DM Serif Display branding block, password show/hide toggle.
- **SettingsPage**: emoji tab icons removed, text-only tabs with bottom-border active indicator.
- **ClientsPage**: `+` text button → Lucide `Plus` icon with rounded square style; skeleton loading.
- **InvoiceActions**: emoji → Lucide `FileDown` icon.
- **`_components.tsx`**: CSS transition focus ring on `Field`; `PrimaryButton` gets warm box-shadow.
- **`index.css`**: `color-scheme: light` (explicit, not `light dark`); `overscroll-behavior: none`; expanded token scale (`--radius-xs/xl`, `--shadow-xs/nav`).

### Branch / PR
`ui/ios-premium-overhaul` → PR #19

---


## [2026-06-02] — Cloudflare Deployment Build Fixes

### Fixed
- `app/package-lock.json` — deleted stale v3 lock file. Lock file still referenced `tailwindcss@3.4.19` while `package.json` required `^4.0.0`, causing `npm ci` to fail with "lock file not in sync" error. Cloudflare regenerates a clean lock on fresh install.
- `app/package.json` — added `pdfjs-dist@^4.0.0` and `tesseract.js@^5.0.0` to `dependencies`. Both packages were imported in `ocrPdf.ts` but missing from `package.json`. They worked locally as transitive/global installs but Cloudflare's clean CI environment has no such fallback.
- `app/src/index.css` — moved `@import url(Google Fonts)` to line 1, before `@tailwind` directives. CSS spec requires `@import` to precede all other rules. Tailwind v4 compiles `@tailwind` directives into real CSS rules, making the out-of-order `@import` a hard build error in Vite.

### Observations
- Root cause of all three errors: packages were installed locally in a non-clean environment, masking missing `package.json` entries. Running `rm -rf node_modules && npm install && npm run build` locally before pushing would have caught these before CI.
- Cloudflare Pages falls back from `npm ci` to `npm install` automatically when no lock file is present — useful escape hatch during initial setup.

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
  - **Fetch strategy:** Vite `/assets/` hashed files → cache-first. Navigation → network-first with `index.html` fallback. Supabase URLs → always bypassed.
- `app/public/_redirects` — Cloudflare Pages SPA routing. Single line: `/* /index.html 200`.
- `app/src/registerSW.ts` — `registerServiceWorker()` function.
- `app/public/icons/icon-192.png` — 192×192 PNG icon.

### Changed
- `app/index.html` — iOS PWA meta tags, manifest link, `viewport-fit=cover`, `theme-color`.
- `app/src/main.tsx` — `registerServiceWorker()` called after React root mount.

### Observations
- `icon-512.png` and `apple-touch-icon.png` still pending — must be added as PNG rasters manually.
- SW deliberately bypasses all Supabase calls to prevent stale-auth bugs.
- Cloudflare Pages: build root = `app/`, build command = `npm run build`, output = `dist`.

---

## [2026-06-01] — Dashboard / Home Tab (Phase 4)

### Added
- `supabase/migrations/008_dashboard_ignores.sql` — `dashboard_ignores` table.
- `app/src/db/dashboardDb.ts` — KPI, unbilled, vehicle revenue, WO flags, monthly trend queries.
- `app/src/ui/dashboard/DashboardPage.tsx` — full dashboard page.
- `app/src/ui/AppShell.tsx` — 🏠 Home as tab 0.

### Fixed
- `DashboardPage.tsx` — `inv.totalInvoiceAmount` → `inv.totalAmount`.
- `DashboardPage.tsx` — CSS var `--color-info` → `--color-primary`.

### Changed
- `dashboardDb.ts` — replaced `fetchRecentInvoices()` with `fetchMonthlyTrend()`.

### Observations
- `vehicle_billing_ledger` makes all dashboard queries fast — no joins needed.
- Chart.js loaded from CDN lazily on first Dashboard render only.

---

## [2026-06-01] — Cancel Invoice + Edit Finalised Invoice + InvoicesPage Redesign

### Added
- `supabase/migrations/008_decrement_billed_qty_rpc.sql` — `decrement_billed_qty` RPC.
- `cancelInvoice(invoiceId)` in `invoicesDb.ts` — reverses qty + ledger, sets `status = 'cancelled'`.

### Fixed
- `InvoiceWizard.tsx` — Next button was hidden when editing a final invoice.

### Changed
- `InvoicesPage.tsx` — teal header, FY selector, status filter pills, VOID stamp, `InvoiceCard` extracted.

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
