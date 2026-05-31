# Changelog

> Most recent entries first. Keep the last 15 entries.

---

## [2026-05-31] — PDF Layout Fixes (Session 2)

### Fixed
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — **Header overlap fix:** Added `lineHeight: 1.0` and `marginBottom: 4` to `headerBusinessName` style. `@react-pdf/renderer` inherits the page-level `lineHeight: 1.4` into all text nodes; without an explicit override on the 18pt business name, the descenders bled into the address line below, causing the two texts to visually overlap. Setting `lineHeight: 1.0` on the name and `lineHeight: 1.2` on `headerAddress` creates clean vertical separation.
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — **Logo size increase:** `LOGO_SIZE` constant bumped from its previous value to `100` (approximately 2× the original rendered size). Logo wrap, image, and placeholder all derive from this constant so all three update together.
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — **Description of Services left-indent fix:** Removed `paddingHorizontal: 10` from `descBlock` style. The 10pt horizontal padding was causing the `DESCRIPTION OF SERVICES` heading and body text to be indented relative to every other section (TAX INVOICE stamp, two-column metadata block, table rows) which all sit flush with the page margin. With the padding removed, the description block aligns correctly with all surrounding sections.

### Observations
- The header overlap was not a z-index or absolute-positioning issue — `@react-pdf/renderer` uses a Flexbox-based flow layout. The cause was inherited `lineHeight` from the page style amplifying the apparent line height of the large display font. Explicit `lineHeight` overrides on the text nodes are the canonical fix.
- `paddingHorizontal` on `descBlock` was redundant — the page already applies `paddingHorizontal: PAGE_MARGIN (32)` globally. The inner padding was additive, not a replacement, creating the unintended indent.
- These are visual/cosmetic fixes only. No data flow, props, or business logic was changed.

---

## [2026-05-31] — Bug Fix: TDS Always Showing 0% (3 Root Causes)

### Fixed
- `app/src/ui/invoices/Section1Header.tsx` — **Bug 1 (init guard):** `emptyDraft()` initialises `tds_rate = 0`, so the old guard `if (draft.tds_rate === undefined)` was always false and settings were never applied. Guard changed to `if (!draft.work_order_id)` — TDS from global settings is now written unconditionally on first load when no WO is linked.
- `app/src/ui/invoices/Section1Header.tsx` — **Bug 2 (WO selection):** Added new `useEffect` on `[draft.work_order_id, workOrders, loading]`. When a Work Order is selected, it reads the WO's `tds_applicable` flag and sets `tds_rate` to `default_tds_rate` from cached settings (if applicable) or `0`. Clearing the WO reverts to the global setting. A contextual hint line is shown below the WO dropdown ("✓ TDS 2% applied from work order settings" or "ℹ TDS not applicable for this work order").
- `app/src/ui/invoices/Section4Review.tsx` — **Bug 3 (hidden row):** The entire TDS block was wrapped in `{draft.tds_rate > 0 && ...}`, making it invisible at 0% with no way to correct it. Replaced with a new `<TdsRow>` component that is always rendered. Shows the current rate as a tappable pill; tapping opens an inline number input (0–30%). On commit, calls `recomputeTotals()` and patches `tds_amount` and `net_receivable`. Net Receivable row still only appears when TDS > 0.

### Observations
- `emptyDraft()` initialising `tds_rate = 0` was the root cause — the `=== undefined` guard was a logical dead-end from day one. The fix does not change `emptyDraft()` itself; instead the init effect is made unconditional on fresh drafts.
- Caching `default_tds_rate` and `tds_applicable` from settings into component state (`cachedTdsRate`, `cachedTdsApplicable`) was necessary so the WO-selection effect can reference them without a second DB call.
- Inline TDS edit in Section 4 is the safety net — even if the auto-derived rate is wrong, the user can correct it before finalising without leaving the review screen.

---

## [2026-05-31] — Analysis: AI Description Quality Gap — Rental vs Quantity

### Identified (Not Yet Fixed)
- Diagnosed why AI-generated descriptions were good for quantity invoices but poor for rental invoices.
- **Root cause 1 — Empty `work_item_descriptions`:** The prompt builder sends `draft.line_items[].description` as `work_item_descriptions`. For rental invoices, `line_items` is always `[]`, so the AI receives an empty list every time. The system prompt says "if provided" — so it just skips the field and produces generic output.
- **Root cause 2 — Vague system prompt:** `SYSTEM_INSTRUCTION_RENTAL` says "Describe which vehicles were deployed" — this passive, open-ended instruction leads to list-style enumeration rather than a flowing professional sentence.
- **Root cause 3 — No fallback instruction:** When `work_item_descriptions` is empty, the prompt builder adds nothing to tell the AI to derive work context from `wo_subject` instead.

### Planned Fixes (deferred to next session or separate fix)
1. Add an optional **Work Description** free-text field in Section 2 rental items form → passed as `work_item_descriptions` to the Edge Function.
2. Rewrite `SYSTEM_INSTRUCTION_RENTAL` in the Edge Function to be directive and narrative-first ("Write as a single flowing professional sentence...").
3. Add explicit fallback instruction in `buildGeneratePrompt()` when `work_item_descriptions` is empty: "Derive the nature of work from the Work Order Subject. Do not leave the description vague."

---

## [2026-05-31] — Bug Fix: Invoice Date → Billing Period Auto-Recalculation

### Fixed
- `app/src/ui/invoices/useInvoiceDraft.ts` — `prevMonthRange()` now accepts an optional `baseDate?: Date` parameter instead of always using `new Date()` internally. Function is now exported so UI components can call it directly.
- `app/src/ui/invoices/Section1Header.tsx` — Added `handleInvoiceDateChange()` handler on the Invoice Date field. When the user changes the invoice date, `billing_from` and `billing_to` are automatically recomputed as the first and last day of the previous month *relative to the selected invoice date*. All three fields are patched in a single `patch()` call. User can still manually override `billing_from` / `billing_to` after the auto-fill.
- Added `parseLocalDate()` helper in `Section1Header.tsx` to safely parse `YYYY-MM-DD` strings as local dates (avoids the UTC-midnight → IST timezone shift that `new Date(isoString)` causes).

### Observations
- Root cause: `prevMonthRange()` was only ever called once at wizard init (`emptyDraft()`). The `invoice_date` `onChange` handler called `patch({ invoice_date: v })` directly, which never re-derived the billing period. Adding a base-date parameter to `prevMonthRange()` and wiring it into the date change handler was the minimal, zero-risk fix.
- `billing_from` / `billing_to` remain independently editable — the auto-fill on invoice date change is a default, not a lock.
- `parseLocalDate()` is reused from the existing IST-safe date handling pattern already present in the file (`formatISODate` avoids `new Date(isoString)` for the same reason).

---

## [2026-05-31] — PDF Font CDN Fix

### Fixed
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — all 6 `Font.register()` URLs updated from broken npm package-path format to the correct Fontsource jsDelivr CDN scheme
  - Old (broken): `https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-400-normal.ttf`
  - New (working): `https://cdn.jsdelivr.net/fontsource/fonts/inter@5/latin-400-normal.ttf`
  - Same fix applied to Inter 500/600/700 and Lora 400/700

### Observations
- Fontsource migrated away from the npm `files/` path structure; the new CDN route is `cdn.jsdelivr.net/fontsource/fonts/{font}@{version}/{subset}-{weight}-{style}.{ext}`
- `.ttf` format required (not `.woff2`) — `@react-pdf/renderer` fetches raw font bytes and cannot decode woff2
- All 6 TTF URLs manually verified in browser before committing
- The broken URLs caused a `PDF Error: Failed to fetch font … 404` that prevented any PDF from rendering

---

## [2026-05-30] — PDF Invoice Generation — Part 3: PDF Rendering

### Added
- `app/src/ui/invoices/pdf/InvoiceDocument.tsx` — main `@react-pdf/renderer` document component, portrait A4, dual-axis color system (tax mode × billing type), both Playfair Display + Work Sans fonts registered, full 10-section layout: header band → identity band → details+bill-to → SAC chip → description → line items → totals → amount in words → bank details → declaration+signature
- `app/src/ui/invoices/pdf/QuantityLineItemsTable.tsx` — table component for quantity invoices: Sl. No / Description / Unit / Qty / Rate / Taxable Value columns with alternating row tint
- `app/src/ui/invoices/pdf/RentalLineItemsTable.tsx` — table component for rental invoices: Vehicle / Billing Mode / Days / Monthly Rent / Subtotal columns + Work Items Covered informational block (from `invoice_item_distribution`)
- `app/src/ui/invoices/pdf/invoicePayloadTypes.ts` — TypeScript interfaces for all PDF data (`InvoicePayload`, `SupplierPayload`, `ClientPayload`, `BankPayload`, `InvoiceMetaPayload`, `QuantityLineItemPayload`, `RentalLineItemPayload`, `DistributionItemPayload`)
- `app/src/ui/invoices/pdf/pdfUtils.ts` — `formatCurrency()` (Indian rupee format), `formatDate()` (DD/MM/YYYY), `toWords()` (Indian place-value words with Crore/Lakh/Thousand)
- `app/src/ui/invoices/pdf/buildInvoicePayload.ts` — async function that fetches invoice + FK joins + settings + billing-type-branched child items and assembles `InvoicePayload`
- `app/src/ui/invoices/pdf/InvoicePreviewModal.tsx` — full-screen modal with `PDFViewer` (desktop) or download prompt (mobile), Download button (`PDFDownloadLink`), Share button (Web Share API with blob fallback), lazy PDF upload to Supabase Storage on open
- `app/src/ui/invoices/InvoiceActions.tsx` — reusable "View / Download PDF" button component for invoice detail sheets and list cards; hides on draft invoices
- `app/src/db/invoicePdfDb.ts` — `uploadInvoicePdf()` (uploads blob to `invoices` bucket, sets `pdf_url` on row) and `getInvoiceDownloadUrl()` (signed URL for private bucket access)
- `supabase/migrations/007_invoices_pdf_url.sql` — adds `pdf_url TEXT` column to `invoices` table + 3 RLS policies for `storage.objects` (INSERT / SELECT / UPDATE on `invoices` bucket)

### Design Decisions Made
- `@react-pdf/renderer` chosen over jsPDF + html2canvas (vector output, JSX layout, no coordinate math)
- Portrait A4 orientation (Indian GST standard)
- Dual-axis color system: tax mode drives accent color (gold = CGST/SGST, steel blue = IGST); billing type drives table header (parchment = quantity, cool blue-grey = rental)
- SAC code as standalone chip between Bill To and description
- Description of services placed above line items table
- Work Items Covered block for rental invoices only (from `invoice_item_distribution`)
- Invoice number as prominent right-aligned bordered box in document identity band

### Observations
- `@react-pdf/renderer` cannot use Tailwind or CSS variables — all styles are `StyleSheet.create()` objects; this is a deliberate PDF-only pattern and does NOT affect the app's UI styling rules
- `PDFViewer` is intentionally hidden on mobile (screen width < 768px) and replaced with a download prompt — PDFViewer renders an iframe which is heavy and poorly supported on mobile WebViews
- PDF upload to Supabase Storage is intentionally non-blocking (fire-and-forget with console.warn on failure) — the user can still download the PDF even if the upload fails
- Web Share API (`navigator.share`) with file sharing is supported on Android Chrome and iOS Safari 15.1+; desktop fallback triggers a download
- `toWords()` in `pdfUtils.ts` is a self-contained Indian place-value implementation (Crore → Lakh → Thousand → Hundred) — no third-party dependency
- `invoices` bucket must exist before running migration 007 (it was created manually on 2026-05-24)
- **Note:** A secondary implementation (`generatePdf.ts` using jsPDF) also exists on this branch from an earlier brainstorm session — it is superseded by `InvoicePdf.tsx` and should be deleted before merge

---

## [2026-05-28] — Invoice Wizard — Phase 3 Parts 1–2 (Rental Billing + AI Description)

### Added
- `supabase/migrations/006_rental_billing.sql` — adds `invoice_rental_items`, `invoice_item_distribution`, `vehicle_billing_ledger` tables; adds `line_item_billing_type` to `invoices`; adds `applicable_billing_type` to `sac_codes`
- `invoicesDb.ts` updated with quantity + rental finalization paths, `cancelInvoice()`, `fetchInvoice()`
- `Section2Items.tsx` — billing mode selector + rental sub-form (vehicle rows, billing mode, days, monthly rent) + distribution panel with equal-split default + live 100% sum guard
- `Section3Description.tsx` — rental mode: read-only vehicle summary; quantity mode: multi-select WO items picker; both modes: AI description generation + manual edit textarea
- `useInvoiceDraft.ts` updated with rental item + distribution draft state
- `generate-invoice-description` Supabase Edge Function — rental-aware prompt (no per-day rate language)

### Observations
- Rental-aware AI prompt required explicit instruction to exclude per-day rate phrasing — Gemini/GPT defaulted to computing and stating a daily rate without this constraint
- Distribution panel equal-split default (total / num_items, remainder cent on first item) is the most common real-world use case

---

## [2026-05-27] — Invoice Wizard — Phase 3 Part 1 (Wizard Shell + Section 1 Header)

### Added
- Invoice tab added to AppShell (6th tab)
- `InvoicesPage.tsx` — list of invoices with status chips, create button
- `InvoiceWizard.tsx` — 4-section wizard orchestrator with slide-in animation
- `WizardNav.tsx` — sticky progress bar with section breadcrumbs
- `useInvoiceDraft.ts` — central wizard state hook, draft persistence
- `Section1Header.tsx` — client picker, GSTIN picker, WO picker, date fields, billing type selector (quantity / rental), SAC picker (filtered by billing type), bank account picker, tax mode, TDS toggle
- `Section4Review.tsx` — read-only summary of all sections, finalize button
- `invoicesDb.ts` — `saveDraftInvoice()`, `finalizeInvoice()` (quantity path), `listInvoices()`
- `invoiceNumberingDb.ts` — `generateInvoiceNumber()` via Edge Function

### Observations
- SAC dropdown filter by `applicable_billing_type` requires running migration 006 first
- Wizard uses hash-based section navigation (§1–§4) to avoid page reload on section transition

---

## [2026-05-26] — Invoice Face Design (compliance-first layout decisions)

### Added
- Compliance-first invoice section structure locked in `design-decisions.md`
- TDS as informational summary line below GST total (not a GST field)
- W.O. Reference in muted low-emphasis style in metadata block
- No project name / vehicle block on invoice face (internal records only)

---

## [2026-05-24] — Work Orders Module — Part 2 (OCR + AI Parse)

### Added
- `WorkOrderFormModal.tsx` updated with OCR + AI-prefill mode
- `parse-work-order` Supabase Edge Function (OpenAI/Gemini-powered WO PDF parsing)
- Tesseract.js in-browser OCR for PDF text extraction
- `workOrdersDb.ts` — `uploadWorkOrderPdf()`, `saveExtractedText()`

### Observations
- Tesseract accuracy is sufficient for clean scanned WO PDFs from RSV Constructions
- Supabase Edge Function env var for AI API key set via `supabase secrets set`

---

## [2026-05-24] — Work Orders Module — Part 1 (Schema + CRUD)

### Added
- `supabase/migrations/004_invoice_numbering.sql`, `005_projects_and_work_orders.sql`
- `WorkOrdersPage.tsx`, `WorkOrderCard.tsx`, `WorkOrderFormModal.tsx`, `WorkOrderDetailSheet.tsx`
- `workOrdersDb.ts` — CRUD + `computeWOStatus()`
- `projectsDb.ts`, `ProjectsPage.tsx`, `ProjectCard.tsx`, `ProjectFormModal.tsx`
- AppShell updated to 5 tabs (added Work Orders + Projects)

### Observations
- `wo_reference` used over `wo_number` (see design-decisions.md)
- Client-side `computeWOStatus()` is zero-infrastructure — never stale

---

## [2026-05-23] — Vehicles Module

### Added
- `supabase/migrations/003_vehicles.sql`
- `VehiclesPage.tsx`, `VehicleCard.tsx`, `VehicleFormModal.tsx`, `VehicleDetailSheet.tsx`
- `vehiclesDb.ts` — CRUD with soft delete
- AppShell updated to 4 tabs (added Vehicles)

### Observations
- `default_monthly_rent` on vehicles is a pre-fill hint only; not authoritative
