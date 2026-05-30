# Progress

> Updated at the end of every chat session.

---

## Current Phase: Phase 3 — Invoice Generation ✅ COMPLETE

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
- ✅ **PDF Rendering Part 3** (react-pdf renderer, quantity + rental layout paths, preview modal, upload to Storage, download + share)

---

## What's Next — Phase 4: Polish & Analytics

### Next Feature: **Invoice List & Detail Sheet**
- Wire `InvoiceActions` component into `InvoicesPage.tsx` invoice cards
- Invoice detail sheet (full read-only view of a finalized invoice with PDF button)
- Cancel invoice action (with confirmation + ledger rollback)
- Filter/search invoices by client, date range, status

### Subsequent Features
- Work Order utilisation bars (consumed vs contracted qty per WO item)
- Revenue per vehicle dashboard (from `vehicle_billing_ledger`)
- Duplicate invoice (copy draft from existing final invoice)
- Settings: logo upload (Supabase Storage → `settings.logo_url`)
- PWA manifest + service worker (offline shell)

---

## Known Issues / Deferred
- [ ] `@react-pdf/renderer` needs to be added to `package.json` dependencies (`npm install @react-pdf/renderer`)
- [ ] Run migration `007_invoices_pdf_url.sql` in Supabase SQL Editor
- [ ] `invoices` Supabase Storage bucket must be set to PUBLIC or signed-URL access configured (currently private — `getInvoiceDownloadUrl()` uses signed URLs)
- [ ] Test font loading in PDF — Google Fonts woff2 URLs used; verify Supabase Edge network can resolve them at PDF render time (react-pdf fetches fonts at render)
- [ ] `InvoiceActions` component needs to be imported and rendered inside `InvoiceDetailSheet` (to be built in Phase 4)
