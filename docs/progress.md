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
  - ⬜ NOT YET: End-to-end test + `npm install @react-pdf/renderer` + migration 007 run

### Bug Fixes — `bugfix/pre-feature-fixes-20260531` (merged to main)
- ✅ Bug 1–7: TDS, rental recompute, invoice identity, draft deletion, UI separation
- ✅ PDF Fix 1–4: Header overlap, logo size, description indent, gold separator line

### Phase 4 — Polish & Analytics
- ✅ **Dashboard / Home Tab** — complete on `feature/dashboard-home-20260601`
  - ✅ Migration `008_dashboard_ignores.sql` — `dashboard_ignores` table
  - ✅ `dashboardDb.ts` — `fetchKpis`, `fetchUnbilledVehicles`, `fetchVehicleRevenue`, `fetchWoFlags`, `fetchMonthlyTrend`, `ignoreUnbilledMonth`, `unignoreUnbilledMonth`
  - ✅ `DashboardPage.tsx` — sticky header, unbilled alert, KPI strip, vehicle revenue chart, WO flags, 6-month billing trend chart
  - ✅ `AppShell.tsx` — 🏠 Home as tab 0, default tab changed to `home`
  - ⬜ NOT YET: Run migration `008_dashboard_ignores.sql` in Supabase SQL Editor
  - ⬜ NOT YET: Test on device + merge PR to main

---

## What's Next

### Immediate: Test & merge Dashboard PR
1. Run migration `008_dashboard_ignores.sql` in Supabase SQL Editor
2. Pull `feature/dashboard-home-20260601` locally, run `npm run dev`
3. Verify: Home tab loads, KPIs show, both Chart.js charts render, unbilled alert + ignore/restore works, MoM badge shows
4. Merge PR to main

### Also pending: Finish PDF Part 3
1. `npm install @react-pdf/renderer` (confirm in `package.json`)
2. Run migration `007_invoices_pdf_url.sql` in Supabase SQL Editor
3. Test PDF preview → download flow end-to-end
4. Merge `feature/pdf-rendering-part3-20260530` → main

### Remaining Phase 4 items
- Invoice detail sheet (full read-only view of a finalized invoice)
- Filter/search invoices by client, date range, status
- Work Order utilisation bars (consumed vs contracted qty per WO item)
- Duplicate invoice (copy draft from an existing final invoice)
- AI description quality fix for rental invoices (3 planned fixes)
- Settings: logo upload (Supabase Storage → `settings.logo_url`)
- PWA manifest + service worker (offline shell)

---

## Known Issues / Deferred
- [ ] `@react-pdf/renderer` must be added to `package.json` — not yet confirmed
- [ ] Run migration `007_invoices_pdf_url.sql` before testing PDF
- [ ] Run migration `008_dashboard_ignores.sql` before testing dashboard ignore feature
- [ ] `invoices` Supabase Storage bucket is private — signed URLs expire in 1 hour
- [ ] Two PDF layout implementations exist (`InvoicePdf.tsx` + superseded `generatePdf.ts`) — `generatePdf.ts` should be deleted before merge
- [ ] AI description quality gap for rental invoices — 3 fixes planned
- [ ] No DB-level aggregation for WO utilisation — computed client-side from `work_order_items`
