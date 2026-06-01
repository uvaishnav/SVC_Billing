# Progress

> Updated at the end of every chat session.

---

## Current Phase: Phase 4 — Polish & Analytics (Dashboard in progress on `feature/dashboard-home-20260601`)

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
  - ✅ `InvoicePdf.tsx` — complete A4 PDF layout using `@react-pdf/renderer` (11-section layout, both quantity + rental paths)
  - ✅ `invoicePayloadTypes.ts` — TypeScript interfaces for PDF data
  - ✅ `pdfUtils.ts` — `formatCurrency()`, `formatDate()`, `toWords()` (Indian place-value)
  - ✅ `buildInvoicePayload.ts` — async data assembler (invoice + FK joins + settings)
  - ✅ `InvoicePreviewModal.tsx` — full-screen preview modal, download + share + Supabase upload
  - ✅ `InvoiceActions.tsx` — reusable PDF action button component
  - ✅ `invoicePdfDb.ts` — `uploadInvoicePdf()` + `getInvoiceDownloadUrl()`
  - ✅ `supabase/migrations/007_invoices_pdf_url.sql` — adds `pdf_url` column + storage RLS policies
  - ⬜ NOT YET: End-to-end test (open preview modal → PDF renders → download works)
  - ⬜ NOT YET: `npm install @react-pdf/renderer` confirmed in `package.json`
  - ⬜ NOT YET: Migration 007 run in Supabase SQL Editor

### Bug Fixes — `bugfix/pre-feature-fixes-20260531` (merged to main)
- ✅ Bug 1–7: TDS, rental recompute, invoice identity, draft deletion, UI separation
- ✅ PDF Fix 1–4: Header overlap, logo size, description indent, gold separator line

### Phase 4 — Polish & Analytics
- 🔧 **Dashboard / Home tab** — in progress on `feature/dashboard-home-20260601`
  - ✅ Migration `008_dashboard_ignores.sql` — `dashboard_ignores` table (vehicle_id + year_month, UNIQUE constraint, RLS)
  - ✅ `dashboardDb.ts` — `fetchKpis()`, `fetchUnbilledVehicles()`, `fetchVehicleRevenue()`, `fetchWoFlags()`, `fetchRecentInvoices()`, `ignoreUnbilledMonth()`, `unignoreUnbilledMonth()`
  - ✅ `DashboardPage.tsx` — full dashboard: sticky header, unbilled alert (expandable, ignore/restore), KPI 2×2 grid, vehicle revenue Chart.js horizontal bar (month/FY toggle), WO flags (expiring + near-limit), recent invoices list
  - ✅ `AppShell.tsx` updated — 🏠 Home as tab 0, default active tab changed from `invoices` to `home`
  - ⬜ NOT YET: Run migration `008_dashboard_ignores.sql` in Supabase SQL Editor
  - ⬜ NOT YET: Test on device (verify Chart.js CDN loads, unbilled detection works)
  - ⬜ NOT YET: PR merged to main

---

## What's Next

### Immediate: Test & merge Dashboard
1. Run migration `008_dashboard_ignores.sql` in Supabase SQL Editor
2. Pull `feature/dashboard-home-20260601` branch locally
3. Verify: Home tab loads, KPIs show, Chart.js bar chart renders, unbilled alert appears/collapses, ignore works
4. Merge to main

### Also pending: Finish PDF Part 3
1. Confirm `@react-pdf/renderer` in `package.json` (`npm install @react-pdf/renderer`)
2. Run migration `007_invoices_pdf_url.sql` in Supabase SQL Editor
3. Test PDF preview → download flow
4. Merge `feature/pdf-rendering-part3-20260530` → `bugfix` → main

### Remaining Phase 4 items
- Invoice detail sheet (full read-only view of a finalized invoice)
- Cancel invoice action (confirmation + `vehicle_billing_ledger` rollback)
- Filter/search invoices by client, date range, status
- Work Order utilisation bars (consumed vs contracted qty per WO item)
- Duplicate invoice (copy draft from an existing final invoice)
- AI description quality fix for rental invoices (3 planned fixes)
- Settings: logo upload (Supabase Storage → `settings.logo_url`)
- PWA manifest + service worker (offline shell)

---

## Known Issues / Deferred
- [ ] `@react-pdf/renderer` must be added to `package.json` — not yet confirmed
- [ ] Run migration `007_invoices_pdf_url.sql` in Supabase SQL Editor before testing PDF
- [ ] Run migration `008_dashboard_ignores.sql` in Supabase SQL Editor before testing dashboard ignore feature
- [ ] `invoices` Supabase Storage bucket is private — signed URLs expire in 1 hour
- [ ] Two PDF layout implementations exist (`InvoicePdf.tsx` + superseded `generatePdf.ts`) — `generatePdf.ts` should be deleted before merge
- [ ] AI description quality gap for rental invoices — 3 fixes planned, not yet implemented
- [ ] No "billed amount vs WO total value" comparison via DB query exists yet (dashboard uses client-side work_order_items calc)
