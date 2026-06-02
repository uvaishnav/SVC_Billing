# Changelog

> Most recent entries first. Keep the last 15 entries.

---

## [2026-06-02] — iOS PWA Premium UI Overhaul — Design Session

### Planned (not yet implemented — branch `ui/ios-premium-redesign` to be created)
- `app/src/index.css` — safe area CSS tokens (`--safe-top`, `--safe-bottom`), `100dvh`, spring easing vars (`--ease-spring`, `--ease-snappy`), page-enter keyframe animation
- `app/src/ui/AppShell.tsx` — replace emoji with inline SVG Lucide icons, safe-area-aware tab bar height, sliding gold pill indicator (spring animated), page fade-in on tab change
- `app/src/ui/settings/_components.tsx` — shadow-based card elevation (remove solid border), gold focus rings, spring button press, 44px minimum touch targets
- `app/src/ui/invoices/pdf/InvoicePreviewModal.tsx` — PDF.js canvas renderer for mobile/iOS PWA (fixes WKWebView blob iframe bug), "Open in Safari" fallback, safe-area modal header, slide-up entrance animation
- `app/src/ui/dashboard/DashboardPage.tsx` — safe-area-inset-top on sticky header, replace colored left border on KPI cards with pill badge
- All module sticky headers — `padding-top: calc(Npx + env(safe-area-inset-top, 0px))` applied to InvoicesPage, ClientsPage, VehiclesPage, WorkOrdersPage, ProjectsPage, SettingsPage

### Observations
- Root cause of PDF failure on iOS PWA: `PDFViewer` uses `<iframe src="blob:...">` — WKWebView in standalone mode silently blocks blob URI iframes. PDF.js canvas approach is the correct fix.
- Root cause of status bar overlap: zero `env(safe-area-inset-top)` usage anywhere in codebase. All sticky headers use hardcoded `padding: '20px ...'`.
- Emoji inconsistency confirmed: iOS 16 and iOS 17 render 🚛 and 📋 at different visual sizes in fixed UI contexts.
- All 8 design decisions documented in `docs/design-decisions.md` under "iOS PWA Premium UI Overhaul" section.

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
- `app/public/sw.js` — Manual service worker.
- `app/public/_redirects` — Cloudflare Pages SPA routing.
- `app/src/registerSW.ts` — `registerServiceWorker()` function.
- `app/public/icons/icon-192.png` — 192×192 PNG icon.

### Changed
- `app/index.html` — iOS PWA meta tags, manifest link, `viewport-fit=cover`, `theme-color`.
- `app/src/main.tsx` — `registerServiceWorker()` called after React root mount.

---

## [2026-06-01] — Dashboard / Home Tab (Phase 4)

### Added
- `supabase/migrations/008_dashboard_ignores.sql` — `dashboard_ignores` table.
- `app/src/db/dashboardDb.ts` — KPI, unbilled, vehicle revenue, WO flags, monthly trend queries.
- `app/src/ui/dashboard/DashboardPage.tsx` — full dashboard page.
- `app/src/ui/AppShell.tsx` — 🏠 Home as tab 0.

---

## [2026-06-01] — Cancel Invoice + Edit Finalised Invoice + InvoicesPage Redesign

### Added
- `supabase/migrations/008_decrement_billed_qty_rpc.sql` — `decrement_billed_qty` RPC.
- `cancelInvoice(invoiceId)` in `invoicesDb.ts`.

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
