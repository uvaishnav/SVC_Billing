# Changelog

> Most recent entries first.

***

## [2026-05-27] — PDF Invoice Generation Part 2: Invoice Wizard UI + Data Flow

### Added
- `app/src/ui/invoices/InvoiceWizard.tsx` — 4-section wizard orchestrator; accepts `existingStatus` prop to correctly handle editing finalized invoices (number locked, Save Draft hidden, bottom nav hidden)
- `app/src/ui/invoices/Section1Header.tsx` — client selector, GSTIN selector with auto IGST/CGST+SGST detection, invoice date, billing From/To (defaults to 1st–last of previous month), work order link, SAC code, bank account with detail card
- `app/src/ui/invoices/Section2Items.tsx` — line items from linked work order, qty input, rate pre-fill with override warning, taxable value auto-computed
- `app/src/ui/invoices/Section3Description.tsx` — vehicle multi-select, AI description generation via Edge Function, editable textarea
- `app/src/ui/invoices/Section4Review.tsx` — read-only totals (taxable, GST split, TDS, net receivable), amount in words, Finalize + Save Draft buttons; shows lock banner when editing a finalized invoice
- `app/src/ui/invoices/WizardNav.tsx` — top stepper nav with visited/active/pending states
- `app/src/ui/invoices/useInvoiceDraft.ts` — central wizard state hook; `emptyDraft()`, `recomputeTotals()`, `isSectionComplete()`, `prevMonthRange()` with timezone-safe `localISO()` helper
- `app/src/db/invoicesDb.ts` — `saveDraftInvoice()` (upsert by `DRAFT-{timestamp}` key), `finalizeInvoice(draft, existingStatus?)` (assigns invoice number at finalize only; locks number if already final; skips `increment_billed_qty` on re-finalize), `getInvoices()`, `getInvoiceByNumber()`, `cancelInvoice()`
- `app/src/ui/invoices/InvoicesPage.tsx` — invoice list with status pills (All / Draft / Final / Cancelled), search by invoice number or client, tap to open wizard in edit mode

### Changed
- `app/src/ui/invoices/useInvoiceDraft.ts` — removed `generateInvoiceNumber()` import and call; invoice number no longer set on wizard open
- `app/src/ui/invoices/useInvoiceDraft.ts` — `isSectionComplete()` for Section 1 no longer checks `invoice_number` (it is always empty until finalize)
- `app/src/ui/invoices/Section1Header.tsx` — billing period pill uses `formatISODate()` (splits ISO string into parts) instead of `new Date(iso).toLocaleDateString()` to avoid UTC→IST timezone shift
- `app/src/db/invoicesDb.ts` — `finalizeInvoice()` return type changed from `Invoice | null` to `{ invoice: Invoice; invoiceNumber: string } | null` so callers can get the assigned number
- `app/src/ui/invoices/InvoiceWizard.tsx` — `existingStatus` prop wired to `Section4Review`; bottom Save Draft + Next nav hidden when `existingStatus === 'final'`

### Bug Fixes
- **Invoice number consuming sequence on wizard open** — `generateInvoiceNumber()` was called in `Section1Header` `useEffect` on mount; moved to `finalizeInvoice()` only. Sequence now only increments when user taps Finalize.
- **Invoice number changing on re-edit of finalized invoice** — `finalizeInvoice()` now checks `isAlreadyFinal` flag; if true, existing number is kept and `increment_billed_qty` is skipped.
- **Billing period dates off by 1 day (UTC/IST timezone bug)** — `prevMonthRange()` was using `toISOString().slice(0,10)` which converts local midnight to UTC, rolling back 1 day in IST. Fixed with `localISO()` helper that reads `getFullYear()`, `getMonth()`, `getDate()` directly from local time.
- **Bank account dropdown hidden behind sticky bottom nav** — root div `paddingBottom` increased to `120px`.

### Observations
- `toISOString()` is **never safe for local date formatting** in IST (UTC+5:30). Always use `getFullYear()` / `getMonth()` / `getDate()` and format manually. This affects any date initialized via `new Date(year, month, day)` and displayed via `toISOString()`.
- Invoice number must be assigned at **finalization time**, not creation time. Assigning on wizard open wastes sequence numbers on cancellations. This matches how Tally, Zoho, and QuickBooks handle invoice numbering.
- Draft invoices use a stable `DRAFT-{timestamp}` key for upsert identity. This avoids needing a separate `id` lookup before every draft save.
- Vehicle rental billing (daily/monthly rate × duration, not unit × qty) was discovered as a requirement during this session. Schema and wizard changes needed — deferred to a dedicated session before Part 3 PDF rendering.

***

## [2026-05-25] — Work Orders Module Part 2: PDF Upload + OCR + AI Parsing

### Added
- `supabase/functions/parse-work-order/index.ts` — Edge Function calling Gemini 2.5 Flash with `response_schema` for strict JSON extraction; auto-falls back to Groq Llama 3.3 70B on **both 429 (rate limit) and 503 (high demand / UNAVAILABLE)**
- `app/src/utils/ocrPdf.ts` — in-browser PDF→canvas→Tesseract OCR with live page-by-page progress callback; runs 100% client-side before user confirms
- `app/src/utils/parseWorkOrder.ts` — typed client helper that calls the Edge Function and returns `ParsedWorkOrder`
- `app/src/utils/uploadWorkOrderPdf.ts` — uploads PDF to private `work-orders` Storage bucket; returns storage **path** (not public URL); companion `getWorkOrderPdfSignedUrl()` generates 1-hour signed URLs on demand
- **"📎 Upload PDF"** pill button in `WorkOrdersPage` header — triggers OCR→AI→prefill flow with animated step-by-step progress overlay (Reading PDF → Parsing with AI → Ready)
- **AI prefill banner** in `WorkOrderFormModal` when opened via PDF flow — "Fields pre-filled by AI — tap ✏️ to edit"
- **Inline item editing** in `WorkOrderFormModal` — each AI-extracted item card has a ✏️ button that expands into an edit form in-place; ✔ Confirm / ✕ Cancel; Save auto-confirms any open edit
- **"Original Document" section** at bottom of `WorkOrderFormModal` — three states: No PDF / File selected (with size + "Will upload on save") / Already attached (with Replace button); enables retroactive PDF attachment on existing WOs via Edit
- **"📎 View PDF" button** in `WorkOrderDetailSheet` footer — only visible when `original_pdf_url` is set; generates signed URL on tap and opens in new tab; shows "Opening…" loading state and inline error on failure
- **"📎 PDF" badge** in detail sheet header — quick visual indicator that a PDF is attached
- Supabase Storage RLS policies added for `work-orders` bucket (INSERT + SELECT + DELETE for `authenticated` role) — applied via SQL Editor

### Changed
- `WorkOrdersPage`: default `filterStatus` changed from `'all'` to `'active'` — active WOs shown by default on tab open
- `WorkOrderFormModal`: PDF upload errors are now **visible in the form** (not silent console.error); WO is still saved on upload failure with a retry message
- `supabase/functions/parse-work-order/index.ts`: fallback now triggers on **both 429 and 503** — previously only 429 triggered Groq fallback; Gemini 503 (UNAVAILABLE / high demand) is equally transient and must also fall back
- `package.json`: added `pdfjs-dist@^4.10.38` and `tesseract.js@^5.1.1`

### Observations
- Gemini `503 UNAVAILABLE` (high demand) must be treated the same as `429` — both are transient and both should silently fall back to Groq. The original code only handled 429; fixed during session.
- Private Supabase Storage buckets do NOT auto-create RLS policies — you must add INSERT/SELECT/DELETE policies manually or uploads will fail with `new row violates row-level security policy` even for authenticated users.
- Storage path (not public URL) must be stored in `original_pdf_url` for private buckets — signed URLs expire so storing them is useless; store the path and generate signed URLs on demand.
- `pdfjs-dist` CDN worker approach avoids Vite bundler complexity for web workers.
- PDF upload is non-fatal by design: if Storage upload fails, the WO row is still saved cleanly. The user sees an inline error and can retry via Edit.
- Retroactive PDF attachment (for WOs saved before the Storage RLS policies were in place) is done via Edit — open WO → Edit → scroll to "Original Document" → Attach PDF → Save Changes.

***

## [2026-05-24] — Work Orders Module Part 1 (Manual Entry)

### Added
- `supabase/migrations/005_projects_and_work_orders.sql` — `projects`, `work_orders`, `work_order_items` tables with RLS + GRANTs on all tables and sequences
- `app/src/db/types.ts` — added `Project`, `ProjectWithClient`, `WorkOrder`, `WorkOrderWithClient`, `WorkOrderItem`, `WorkOrderStatus`, `BillingType` types; updated `Database` interface map
- `app/src/db/projectsDb.ts` — `getProjects()`, `getAllProjects()`, `upsertProject()`, `deactivateProject()` helpers
- `app/src/db/workOrdersDb.ts` — `getWorkOrders()`, `getWorkOrdersByClient()`, `upsertWorkOrder()`, `closeWorkOrder()`, `getWorkOrderItems()`, `upsertWorkOrderItems()`, `deleteWorkOrderItem()` helpers + `computeWOStatus()` client-side status function
- `app/src/db/index.ts` — exports `projectsDb` and `workOrdersDb`
- `app/src/ui/projects/ProjectsPage.tsx` — full projects list with sticky header, search, empty state
- `app/src/ui/projects/ProjectCard.tsx` — project card with site location, client name, place of supply badge
- `app/src/ui/projects/ProjectFormModal.tsx` — add/edit bottom-sheet modal; state dropdown auto-sets state code; live intrastate/interstate hint
- `app/src/ui/workorders/WorkOrdersPage.tsx` — full work orders list with search + scrollable status filter pills (All / Active / Expiring / Expired / Closed)
- `app/src/ui/workorders/WorkOrderCard.tsx` — card with status badge, days-left indicator for expiring WOs, WO reference, meta row
- `app/src/ui/workorders/WorkOrderFormModal.tsx` — add/edit modal with header fields, client/project dropdowns, billing type selector, rates-firm + TDS toggles, inline line items builder (add/remove)
- `app/src/ui/workorders/WorkOrderDetailSheet.tsx` — detail sheet with 2-col info grid, terms badges, per-item utilisation progress bars (amber at ≥80%), contracted vs billed summary
- `app/src/ui/AppShell.tsx` — expanded from 3 tabs to 5 tabs (Clients | Vehicles | Work Orders | Projects | Settings); tab label font reduced to 10px to fit 5 tabs

### Changed
- `app/src/ui/AppShell.tsx` — tab icon size reduced from 20px to 18px; label size from 11px to 10px; gap reduced from 4px to 2px to fit 5 tabs without crowding

### Deviations from PRD
- **PRD schema** (Section 21.5) has `wo_number` column — **we use `wo_reference`** (more accurately reflects how clients label these documents: "LC-14", "LC-150", etc.)
- **PRD schema** has no `rates_firm`, `tds_applicable`, or `billing_type` columns on `work_orders` — **we added all three** because they are explicitly mentioned in PRD Sections 10.4 and 11.1 as important WO attributes; storing them avoids having to re-read the PDF every time these are needed for invoice creation
- **`sub_work_ref` column** added to `work_order_items` (not in PRD schema) — sample work orders from the business use sub-work references (e.g. "SW:1", "SW:2") within a single WO; needed for item disambiguation and invoice line descriptions
- **Status is computed client-side** via `computeWOStatus()` rather than stored — avoids needing a cron job or trigger to update stale status values; always fresh on load
- **Items use replace-on-save** (delete all + re-insert) rather than differential update — simpler implementation, correct for this use case where the user reviews all items before saving
- **`valid_to` is auto-calculated** from `issue_date + duration_months` at save time — user enters duration in months, not a raw date; matches how real WOs express validity

### Observations
- `work-orders` Supabase Storage bucket must exist before upload flow (Part 2) — **already created manually in dashboard**
- CSS variables `--color-success-highlight`, `--color-warning-highlight`, `--color-error-highlight`, `--color-info-highlight` must exist in `index.css` for status badges to render correctly — check if missing and patch if needed before testing
- 5-tab AppShell works on 390px iPhone width; tab labels are readable at 10px Work Sans
- `computeWOStatus()` must be called after every `getWorkOrders()` fetch to keep statuses live — do NOT rely on the stored `status` column for display (it is only written on explicit `closeWorkOrder()` calls)

***

## [2026-05-24] — Invoice Numbering

### Added
- `supabase/migrations/004_invoice_numbering.sql` — adds `last_fy TEXT` column to `settings`; creates `get_next_invoice_number()` Postgres function with `FOR UPDATE` row lock, FY detection, automatic reset on April 1, and atomic write-back of `current_sequence`, `last_fy`, `last_invoice_number`
- `supabase/functions/generate-invoice-number/index.ts` — Deno Edge Function; verifies JWT (authenticated users only); calls `get_next_invoice_number()` RPC; exponential backoff retry (4 attempts: 0 → 100 → 200 → 400ms)
- `app/src/db/invoiceNumberingDb.ts` — `generateInvoiceNumber(): Promise<string>` frontend helper; reads session JWT, calls Edge Function, returns formatted invoice number (e.g. `SVC/25-26/001`); throws descriptive errors for caller to handle
- `app/src/db/types.ts` — added `last_fy: string | null` to `Settings` interface
- `supabase/migrations/002_clients.sql` — moved to correct repo root location (was incorrectly in `app/supabase/migrations/`)

### Changed
- `docs/architecture.md` — corrected folder structure (single `supabase/` at repo root, no `app/supabase/`); added Supabase CLI rules 6, 7, 8

### Removed
- `app/supabase/migrations/002_clients.sql` — deleted stale duplicate; canonical version is at `supabase/migrations/002_clients.sql`

### Observations
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into Edge Functions at runtime — no manual `secrets set` needed for these
- Postgres `FOR UPDATE` row lock naturally serializes concurrent calls; retry layer handles the rare lock-timeout edge case
- FY stored as `last_fy` TEXT (e.g. `"25-26"`) rather than a year integer — more readable in DB, and the comparison logic is simpler
- Tested via `curl` with a live JWT — confirmed sequential increment and DB write-back

***

## [2026-05-24] — Vehicles Master

### Added
- `supabase/migrations/003_vehicles.sql` — `vehicles` table with RLS + explicit GRANTs on table and sequence
- `app/src/db/vehiclesDb.ts` — `getVehicles`, `upsertVehicle`, `deactivateVehicle` helpers
- `app/src/db/types.ts` — `Vehicle` interface + `vehicles` entry in `Database` type map
- `app/src/ui/vehicles/VehiclesPage.tsx` — list page with sticky header, search, loading/empty states
- `app/src/ui/vehicles/VehicleCard.tsx` — card showing reg number, type, capacity chip, monthly rent chip
- `app/src/ui/vehicles/VehicleFormModal.tsx` — bottom-sheet form for add/edit; reg number auto-uppercased
- `app/src/ui/vehicles/VehicleDetailSheet.tsx` — read-only detail sheet, 2-column grid layout
- `app/src/ui/AppShell.tsx` — added Vehicles tab (between Clients and Settings)

### Observations
- Billing mode analysis (unit-based vs rental) led to removing `unit` and `default_rate` from schema — unit rates are work-order-driven, not vehicle-driven
- `default_monthly_rent` kept as nullable pre-fill hint for rental invoices
- All fields except `reg_number` are nullable by design — user fills incrementally
- Flat single-table design (no child tables) — vehicles have no multi-valued attributes

***

## [2026-05-23–24] — Clients Master

### Added
- `supabase/migrations/002_clients.sql` — `clients` + `client_gstins` tables
- `app/src/db/clientsDb.ts` — full CRUD helpers including `setPrimaryGstin`, `deleteClientGstin`
- `app/src/ui/clients/` — `ClientsPage`, `ClientCard`, `ClientFormModal`, `ClientDetailSheet`

### Changed
- `app/src/ui/AppShell.tsx` — nav overlap fix; `paddingBottom: 64px` on scrollable content area
- `app/src/db/types.ts` — added `Client`, `ClientGstin`, `ClientWithGstins`

### Observations
- Address belongs on `client_gstins` not `clients` (multi-state clients have different registered addresses per GSTIN)
- `GstinDraft` pattern prevents race conditions in multi-item form state
- `upsertClientGstin` requires `{ onConflict: 'client_id,gstin' }` — composite unique key
- All `+ Add` buttons must carry `type="button"` explicitly

***

## [2026-05-23] — Settings Module

### Added
- `supabase/migrations/001_settings.sql` — `settings`, `bank_accounts`, `sac_codes` tables
- `app/src/db/settingsDb.ts` — `getSettings`, `upsertSettings`, `patchSettings`, bank account and SAC CRUD
- `app/src/ui/settings/` — `SettingsPage`, `BusinessProfileForm`, `BankAccountsSection`, `SacCodesSection`, `BillingDefaultsForm`, `_components.tsx`
- `app/src/ui/LoginScreen.tsx` — Supabase Auth login

### Observations
- Single-row `settings` table works well; `patchSettings` vs `upsertSettings` split avoids NOT NULL violations
- Separate `bank_accounts` and `sac_codes` tables future-proof multi-account and multi-code support
