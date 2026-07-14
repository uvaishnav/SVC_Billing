# Progress

> Updated at the end of every chat session.

---

## Current Phase: Phase 4 — Polish & Analytics

---

## Completed Features

### Phase 1 — Foundation
- ✅ Project scaffold (React + Vite + TypeScript + Supabase)
- ✅ Auth (login screen, session management)
- ✅ AppShell with tab navigation
- ✅ Settings module (business profile, bank accounts, SAC codes, billing defaults)
- ✅ Clients module (client CRUD, multi-GSTIN management)
- ✅ Vehicles module (vehicle CRUD, soft delete)

### Phase 2 — Work Orders
- ✅ Invoice numbering (atomic Postgres RPC, FY-aware sequence reset)
- ✅ Projects module (CRUD, client link)
- ✅ Work Orders module Part 1 (schema, CRUD, status computation)
- ✅ Work Orders module Part 2 (OCR + AI parsing via Edge Function)

### Phase 3 — Invoice Generation
- ✅ Invoice face design decisions (compliance-first layout locked)
- ✅ Invoice Wizard Part 1 (shell + Section 1 Header, Section 4 Review, finalize)
- ✅ Invoice Wizard Part 2 (Section 2 rental billing + distribution, Section 3 description + AI)
- 🔧 **PDF Rendering Part 3** — code is on branch `feature/pdf-rendering-part3-20260530`, needs testing + wiring
  - ✅ `InvoicePdf.tsx` — complete A4 PDF layout
  - ✅ `invoicePayloadTypes.ts`, `pdfUtils.ts`, `buildInvoicePayload.ts`
  - ✅ `InvoicePreviewModal.tsx`, `InvoiceActions.tsx`, `invoicePdfDb.ts`
  - ✅ `supabase/migrations/007_invoices_pdf_url.sql`
  - ⬜ NOT YET: End-to-end test + migration 007 run

### Bug Fixes — `bugfix/pre-feature-fixes-20260531` (merged to main)
- ✅ Bug 1–7: TDS, rental recompute, invoice identity, draft deletion, UI separation
- ✅ PDF Fix 1–4: Header overlap, logo size, description indent, gold separator line

### Phase 4 — Polish & Analytics
- ✅ **Dashboard / Home Tab** — complete, merged to main
  - ✅ Migration `008_dashboard_ignores.sql` — `dashboard_ignores` table
  - ✅ `dashboardDb.ts` — KPI, unbilled, vehicle revenue, WO flags, monthly trend queries
  - ✅ `DashboardPage.tsx` — sticky header, unbilled alert, KPI strip, charts, WO flags
  - ✅ `AppShell.tsx` — 🏠 Home as tab 0
  - ⬜ NOT YET: Run migration `008_dashboard_ignores.sql` in Supabase SQL Editor

- ✅ **PWA + Cloudflare Deployment** — LIVE
  - ✅ `app/public/manifest.json` — Web App Manifest
  - ✅ `app/public/sw.js` — manual service worker (cache-first shell, network-only Supabase)
  - ✅ `app/public/_redirects` — Cloudflare Pages SPA routing
  - ✅ `app/index.html` — iOS PWA meta tags + manifest link + viewport-fit=cover
  - ✅ `app/src/registerSW.ts` + `app/src/main.tsx` — SW registration on boot
  - ✅ `app/public/icons/icon-192.png` — 192×192 PNG icon
  - ✅ `pdfjs-dist` + `tesseract.js` added to `package.json` (were missing, caught by Cloudflare CI)
  - ✅ `@import` Google Fonts moved before `@tailwind` directives in `index.css`
  - ✅ Stale `package-lock.json` (Tailwind v3 entries) deleted — Cloudflare regenerates fresh
  - ✅ Cloudflare Pages project connected to `uvaishnav/SVC_Billing`, build root: `app/`
  - ⬜ NOT YET: `app/public/icons/icon-512.png` — must be added manually (512×512 PNG)
  - ⬜ NOT YET: `app/public/apple-touch-icon.png` — must be added manually (180×180 PNG, iOS home screen)

- ✅ **iOS PWA Premium UI Overhaul** — COMPLETE, live on `main`
  - ✅ `app/src/index.css` — safe-area CSS tokens (`--safe-top`, `--safe-bottom`), `100dvh`, spring easing vars (`--ease-spring`, `--ease-snappy`), `@keyframes page-enter`, shimmer animation, `.page-header` + `.tab-bar` + `.tab-btn` + `.btn-primary` CSS classes
  - ✅ `app/src/ui/AppShell.tsx` — inline SVG icons (house, file-text, user, truck, clipboard, folder, settings), safe-area-aware tab bar height via `tab-bar` CSS class, `page-enter` fade animation on tab change, `100dvh` root, gold active pip per tab
  - ✅ `app/src/ui/settings/_components.tsx` — shadow-based card elevation (`boxShadow` + quiet alpha border), `PrimaryButton` uses `btn-primary` CSS class with spring press, `inputStyle` transitions, 44px minimum touch targets
  - ✅ `app/src/ui/invoices/pdf/InvoicePreviewModal.tsx` — Safari window reference approach: synchronous `window.open()` in onClick, redirect to blob URL when ready; mobile spinner → "done" / "blocked" / "error" stages; Web Share API fallback; desktop unchanged (`PDFViewer` iframe)
  - ✅ `app/src/ui/invoices/InvoicesPage.tsx` — sticky header uses `className="page-header"` (CSS handles safe-area padding)
  - ✅ All module sticky headers audited — use `className="page-header"` or equivalent safe-area padding

- ✅ **Invoice Schema Type Alignment** — COMPLETE, live on `main`
  - ✅ `app/src/db/types.ts` — removed obsolete `cgst_amount`, `sgst_amount`, and `igst_amount` columns from frontend `Invoice` type to align with physical DB schema.
  - ✅ `app/src/db/invoicesDb.ts` — reverted database type mapping checks, casting query outputs to `Invoice` and deriving split GST values dynamically for the wizard in `mapInvoiceWithDetailsToDraft`.

- ✅ **Save Draft UI Toast Notification** — COMPLETE, live on `main`
  - ✅ `app/src/ui/invoices/useInvoiceDraft.ts` — updated `saveDraft` helper to propagate Supabase insert/update outcomes back to the caller.
  - ✅ `app/src/ui/invoices/InvoiceWizard.tsx` — added toast notification banners with auto-dismiss timers and glassmorphic styling.

---

## What's Next

### NEXT SESSION: Remaining Phase 4 items (pick one)

**Option A — Invoice Detail Sheet**
Full read-only view of a finalised invoice as a bottom sheet or slide-in panel. Shows all line items, amounts, GST breakdown, client details. Useful for quick reference without opening the wizard.

**Option B — Duplicate Invoice**
Copy-draft from an existing final invoice. Prefills the wizard with all fields from the source invoice. Saves time for recurring clients/vehicles with identical billing.

**Option C — Work Order Utilisation Bars**
Consumed vs contracted qty per WO item shown as progress bars in the Work Orders module. Currently computed client-side from `work_order_items`.

**Option D — AI Description Quality Fix**
3 planned improvements to the AI-generated description for rental invoices (accuracy, formatting, clause completeness).

**Option E — Settings: Logo Upload**
Supabase Storage upload for `settings.logo_url`. Logo appears in the invoice PDF header.

### Also pending: Add missing PWA icons
1. Add `app/public/icons/icon-512.png` (512×512 PNG of app logo) to main branch
2. Add `app/public/apple-touch-icon.png` (180×180 PNG of app logo) to main branch

### Also pending: Finish PDF Part 3
1. Run migration `007_invoices_pdf_url.sql` in Supabase SQL Editor
2. Test PDF preview → download flow end-to-end
3. Merge `feature/pdf-rendering-part3-20260530` → main

---

## Known Issues / Deferred
- [ ] `icon-512.png` and `apple-touch-icon.png` must be added manually — PNG raster of app logo required; iOS ignores SVG
- [ ] Run migration `007_invoices_pdf_url.sql` before testing PDF
- [ ] Run migration `008_dashboard_ignores.sql` before testing dashboard ignore feature
- [ ] `invoices` Supabase Storage bucket is private — signed URLs expire in 1 hour
- [ ] Two PDF layout implementations exist (`InvoicePdf.tsx` + superseded `generatePdf.ts`) — `generatePdf.ts` should be deleted before merge
- [ ] AI description quality gap for rental invoices — 3 fixes planned
- [ ] No DB-level aggregation for WO utilisation — computed client-side from `work_order_items`
- [ ] Cloudflare Pages env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) must be confirmed set in Cloudflare dashboard
