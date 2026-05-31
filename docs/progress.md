# Progress

> Updated at the end of every chat session.

---

## Current Phase: Phase 3 — Invoice Generation (Bug Fixes in progress on `bugfix/pre-feature-fixes-20260531`)

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
  - ✅ Font 404 fix — corrected Fontsource CDN URLs from broken npm-path format to `cdn.jsdelivr.net/fontsource/fonts/` scheme (verified May 2026)
  - ⬜ NOT YET: `InvoiceActions` wired into `InvoicesPage.tsx` invoice cards
  - ⬜ NOT YET: End-to-end test (open preview modal → PDF renders → download works)
  - ⬜ NOT YET: `npm install @react-pdf/renderer` confirmed in `package.json`
  - ⬜ NOT YET: Migration 007 run in Supabase SQL Editor

### Bug Fixes — `bugfix/pre-feature-fixes-20260531`
- ✅ **Bug 1** — Invoice date change now auto-recalculates `billing_from` / `billing_to` as the previous month relative to the selected invoice date (was always using today's date as base).

---

## What's Next

### Immediate: Finish bug fixes on current branch
1. Continue reporting bugs — each fix is committed to `bugfix/pre-feature-fixes-20260531`
2. Once all bugs are fixed, merge this branch → `main`

### Then: Finish & verify PDF Part 3
1. Confirm `@react-pdf/renderer` is in `package.json` (run `npm install @react-pdf/renderer` if not)
2. Run migration `007_invoices_pdf_url.sql` in Supabase SQL Editor
3. Wire `InvoiceActions` into `InvoicesPage.tsx` invoice cards
4. Open an invoice → click PDF button → verify preview modal loads with correct fonts and data
5. Merge `feature/pdf-rendering-part3-20260530` → `main` after test passes

### Phase 4: Polish & Analytics (after Part 3 merge)
- Invoice List & Detail Sheet
  - Invoice detail sheet (full read-only view of a finalized invoice with PDF button)
  - Cancel invoice action (with confirmation + ledger rollback)
  - Filter/search invoices by client, date range, status
- Work Order utilisation bars (consumed vs contracted qty per WO item)
- Revenue per vehicle dashboard (from `vehicle_billing_ledger`)
- Duplicate invoice (copy draft from existing final invoice)
- Settings: logo upload (Supabase Storage → `settings.logo_url`)
- PWA manifest + service worker (offline shell)

---

## Known Issues / Deferred
- [ ] `@react-pdf/renderer` must be added to `package.json` (`npm install @react-pdf/renderer`) — not yet confirmed
- [ ] Run migration `007_invoices_pdf_url.sql` in Supabase SQL Editor before testing
- [ ] `invoices` Supabase Storage bucket must be PUBLIC or signed-URL access configured (currently private — `getInvoiceDownloadUrl()` uses signed URLs)
- [ ] `InvoiceActions` component needs to be imported and rendered inside `InvoicesPage.tsx` cards AND inside the future `InvoiceDetailSheet`
- [ ] Two PDF layout implementations exist on the branch (`InvoicePdf.tsx` using react-pdf and a legacy `generatePdf.ts` using jsPDF) — `generatePdf.ts` should be deleted before merge
