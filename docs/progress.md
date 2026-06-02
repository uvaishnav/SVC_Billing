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

---

## What's Next

### Immediate: Add missing PWA icons
1. Add `app/public/icons/icon-512.png` (512×512 PNG of app logo) to main branch
2. Add `app/public/apple-touch-icon.png` (180×180 PNG of app logo) to main branch
   - These are needed for a proper "Add to Home Screen" experience on iOS
   - Without `apple-touch-icon.png`, iOS uses a screenshot as the home screen icon

### Also pending: Finish PDF Part 3
1. Run migration `007_invoices_pdf_url.sql` in Supabase SQL Editor
2. Test PDF preview → download flow end-to-end
3. Merge `feature/pdf-rendering-part3-20260530` → main

### Remaining Phase 4 items
- [ ] Test embedded Vehicles and Projects panels under Settings tab
- [ ] Verify React Portal rendering of all form modals and detail sheets
- Invoice detail sheet (full read-only view of a finalized invoice)
- Filter/search invoices by client, date range, status
- Work Order utilisation bars (consumed vs contracted qty per WO item)
- Duplicate invoice (copy draft from an existing final invoice)
- AI description quality fix for rental invoices (3 planned fixes)
- Settings: logo upload (Supabase Storage → `settings.logo_url`)

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
