# Changelog

> Most recent entries first. Keep the last 15 entries.

---

## [2026-07-14] — Invoice Schema Type Alignment & Draft Save Toast UI

### Added
- `app/src/ui/invoices/InvoiceWizard.tsx` — added `toast` state and auto-dismiss timer; added standard keyframe animation `@keyframes toast-in` and rendered a custom glassmorphic floating banner overlay to acknowledge draft saving.

### Fixed
- `app/src/db/types.ts` — removed obsolete `cgst_amount`, `sgst_amount`, and `igst_amount` fields from the `Invoice` interface, aligning it with the actual database columns.
- `app/src/db/invoicesDb.ts` — removed mapping of `cgst_amount`/`sgst_amount`/`igst_amount` in `draftToRow`; added dynamic derivation of these fields in `mapInvoiceWithDetailsToDraft` so that they are correctly computed on the fly for the wizard draft state; cast database responses to `Invoice` to fix stricter enum type matching; typed `ledgerRows` array to resolve postgrest upsert insert payload type warnings.
- `app/src/ui/invoices/useInvoiceDraft.ts` — modified `saveDraft` to return the database save response to propagate the draft details to the wizard container for toast acknowledgement.

---

## [2026-07-14] — iOS PWA Premium UI Overhaul — Implementation

### Changed
- `app/src/index.css` — added safe-area CSS tokens (`--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right`) to `:root`; changed `#root` to `min-height: 100dvh`; added `--ease-spring` and `--ease-snappy` easing curves; added `@keyframes page-enter` and `@keyframes shimmer`; added `.page-header`, `.scroll-area`, `.tab-bar`, `.tab-btn`, `.tab-label`, `.tab-icon`, `.btn-primary` CSS classes
- `app/src/ui/AppShell.tsx` — replaced emoji with inline SVG icons (7 tabs); safe-area-aware tab bar via `tab-bar` CSS class; `page-enter` fade animation on tab change keyed by `animKey`; `100dvh` root; gold active pip per tab via `position:absolute` span
- `app/src/ui/settings/_components.tsx` — `cardStyle` uses layered `box-shadow` + quiet alpha-blended border (removed solid `1.5px` border); `PrimaryButton` delegates to `btn-primary` CSS class for spring press; `inputStyle` adds `transition` for focus ring animation; all interactive elements meet 44px touch target
- `app/src/ui/invoices/pdf/InvoicePreviewModal.tsx` — iOS mobile approach rewritten: synchronous `window.open()` inside onClick gives Safari a user-gesture token; blob URL is redirected to that window once ready; stages: `generating → done / blocked / error`; "Open PDF ↗" fallback button when popup blocked; Web Share API (`navigator.share`) for save/share; desktop `PDFViewer` iframe unchanged
- `app/src/ui/invoices/InvoicesPage.tsx` — sticky header uses `className="page-header"` so CSS handles `calc(20px + env(safe-area-inset-top, 0px))` automatically
- All other module sticky headers — confirmed use `className="page-header"` or equivalent safe-area padding

### Observations
- The `InvoicePreviewModal` approach changed from the originally planned PDF.js canvas renderer: the Safari window reference technique (`window.open()` synchronously in onClick, then redirect when blob is ready) is simpler, requires no `pdfjs-dist` rendering code, and gives the user native Safari PDF rendering (pinch-zoom, markup, AirPrint). PDF.js canvas was over-engineered for this use case.
- All 6 planned file changes landed directly on `main` rather than on a separate `ui/ios-premium-redesign` branch. This was already the state found at session start — the overhaul was implemented in a prior session without the branch being tracked in `progress.md`.
- The sliding gold pill tab indicator from the design plan was simplified to a static `position:absolute` gold top-pip per tab. The shared translating pill would require JS measurement of tab widths, which adds complexity without meaningful UX improvement given 7 evenly-spaced tabs.

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
