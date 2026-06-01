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
  - ✅ Font 404 fix — corrected Fontsource CDN URLs (verified May 2026)
  - ✅ Header overlap fix — explicit `lineHeight` on business name and address prevents overlap
  - ✅ Logo size increase — `LOGO_SIZE` bumped to `100` (~2× original)
  - ✅ Description block indent fix — removed `paddingHorizontal: 10` from `descBlock`; section now aligns flush with all others
  - ⬜ NOT YET: End-to-end test (open preview modal → PDF renders → download works)
  - ⬜ NOT YET: `npm install @react-pdf/renderer` confirmed in `package.json`
  - ⬜ NOT YET: Migration 007 run in Supabase SQL Editor

### Bug Fixes — `bugfix/pre-feature-fixes-20260531`
- ✅ **Bug 1** — Invoice date change now auto-recalculates `billing_from` / `billing_to` as the previous month relative to the selected invoice date.
- ✅ **Bug 2** — TDS init guard was always false (`tds_rate === undefined` never fires since `emptyDraft()` sets it to `0`). Fixed: TDS from global settings now applied unconditionally on fresh drafts.
- ✅ **Bug 3** — Linking a Work Order with `tds_applicable: true` had no effect on `tds_rate`. Fixed: new `useEffect` reads WO's TDS flag and applies `default_tds_rate` from settings.
- ✅ **Bug 4** — TDS row in Section 4 was hidden when `tds_rate === 0`, with no way to view or edit it. Fixed: always-visible inline-editable `<TdsRow>` component in Section 4 Review.
- ✅ **Bug 5** — TDS preview in Section 4 used wrong base (`total_amount` instead of `total_taxable`), inflating the displayed value. Fixed: `TdsRow` now receives `taxableAmount` prop and computes `taxableAmount × tdsRate / 100`.
- ✅ **Bug 6** — TDS rate back-derivation in `buildInvoicePayload.ts` used wrong denominator (`total_amount` instead of `total_taxable`), printing wrong rate on PDF. Fixed: changed denominator.
- ✅ **Bug 7** — Rental TDS always 0 in PDF preview because `setRentalItems` never triggered `recomputeTotals`. Fixed: wrapped in `handleSetRentalItems` in `InvoiceWizard.tsx`.
- ✅ **PDF Fix 1** — Header business name overlapping address text. Fixed: explicit `lineHeight: 1.0` + `marginBottom: 4`.
- ✅ **PDF Fix 2** — Logo rendered too small. Fixed: `LOGO_SIZE` increased to `100`.
- ✅ **PDF Fix 3** — Description of Services section indented vs. other sections. Fixed: removed `paddingHorizontal: 10` from `descBlock`.
- ✅ **PDF Fix 4** — Gold separator line above Taxable Value row instead of below. Fixed: moved to `borderBottom` on `tableTaxableRow`.
- ✅ **Invoice Identity Fix** — Draft and final invoices were being upserted by `invoice_number`, causing a new row on every finalization if the number changed. Fixed: `saveDraftInvoice` and `finalizeInvoice` now accept `existingInvoiceId` and use `UPDATE WHERE id = ?` to promote the same row. `useInvoiceDraft`, `InvoiceWizard`, `InvoicesPage`, and `Section4Review` all thread the id through.
- ✅ **Draft Delete** — Added `deleteDraftInvoice(id)` to `invoicesDb.ts`. Deletes all child rows first, then the invoice row. Safety guard prevents deleting non-draft invoices.
- ✅ **UI: Drafts vs Finals separated** — `InvoicesPage` now renders two distinct sections: "Drafts" (top, amber accent, edit-on-tap) and "Finalised Invoices" (bottom, read-only with PDF action button). Draft cards include a 🗑 delete button with inline two-step confirmation.

---

## What's Next

### Immediate: Finish & verify PDF Part 3
1. Confirm `@react-pdf/renderer` is in `package.json` (run `npm install @react-pdf/renderer` if not)
2. Run migration `007_invoices_pdf_url.sql` in Supabase SQL Editor
3. Open an invoice → click PDF button → verify preview modal loads with correct fonts and data
4. Merge `feature/pdf-rendering-part3-20260530` → `bugfix` branch, then `bugfix` → `main`

### After PDF is verified: Merge & move to Phase 4
- Merge `bugfix/pre-feature-fixes-20260531` → `main`

### Phase 4: Polish & Analytics
- Invoice detail sheet (full read-only view of a finalized invoice)
- Cancel invoice action (with confirmation + `vehicle_billing_ledger` rollback)
- Filter/search invoices by client, date range, status
- Work Order utilisation bars (consumed vs contracted qty per WO item) — uses `cumulative_billed_qty`
- Revenue per vehicle dashboard — uses `vehicle_billing_ledger`
- Work order limit alerts (flag when `cumulative_billed_qty × rate` approaches `total_value`)
- Duplicate invoice (copy draft from an existing final invoice)
- AI description quality fix for rental invoices (3 planned fixes — see changelog 2026-05-31)
- Settings: logo upload (Supabase Storage → `settings.logo_url`)
- PWA manifest + service worker (offline shell)

---

## Known Issues / Deferred
- [ ] `@react-pdf/renderer` must be added to `package.json` (`npm install @react-pdf/renderer`) — not yet confirmed
- [ ] Run migration `007_invoices_pdf_url.sql` in Supabase SQL Editor before testing PDF
- [ ] `invoices` Supabase Storage bucket is private — `getInvoiceDownloadUrl()` uses 1-hour signed URLs; ensure bucket RLS policies are in place
- [ ] Two PDF layout implementations exist (`InvoicePdf.tsx` via react-pdf and `generatePdf.ts` via jsPDF) — `generatePdf.ts` is superseded and should be deleted before merge
- [ ] AI description quality gap for rental invoices — 3 fixes planned (see changelog 2026-05-31), not yet implemented
- [ ] No "billed amount vs WO total value" comparison exists yet — needed for work-order-limit alerts in Phase 4
