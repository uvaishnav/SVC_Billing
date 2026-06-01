# Changelog

> Most recent entries first. Keep the last 15 entries.

---

## [2026-06-01] — Dashboard / Home Tab (Phase 4)

### Added

- `supabase/migrations/008_dashboard_ignores.sql` — new `dashboard_ignores` table.
  - Columns: `vehicle_id` (FK → vehicles), `year_month` (TEXT, format `YYYY-MM`).
  - UNIQUE constraint on `(vehicle_id, year_month)` — prevents duplicate ignores.
  - RLS policy: authenticated users only.

- `app/src/db/dashboardDb.ts` — all dashboard data queries.
  - `fetchKpis()` — returns `thisMonthRevenue`, `thisFyRevenue`, `activeWoCount`, `expiringWoCount` (WOs expiring within 30 days). Sources: `vehicle_billing_ledger` (billing_month / financial_year) + `work_orders`.
  - `fetchUnbilledVehicles()` — checks active vehicles against `vehicle_billing_ledger` for current month AND previous month. Returns vehicles with missing ledger rows, plus their `isIgnored` flag from `dashboard_ignores`.
  - `fetchVehicleRevenue(period)` — aggregates `vehicle_billing_ledger.amount` per vehicle for current month or current FY. Returns sorted descending by revenue.
  - `fetchWoFlags()` — returns two flag types: `expiring_soon` (valid_to within 30 days) and `near_limit` (≥80% of contracted value billed). Both computed client-side from `work_orders` + `work_order_items`.
  - `fetchMonthlyTrend()` — queries last 6 months of `vehicle_billing_ledger`, aggregates by `billing_month`, always returns all 6 months (zero-filled if no data).
  - `ignoreUnbilledMonth(vehicleId, yearMonth)` — upserts into `dashboard_ignores`.
  - `unignoreUnbilledMonth(vehicleId, yearMonth)` — deletes from `dashboard_ignores`.

- `app/src/ui/dashboard/DashboardPage.tsx` — full dashboard page component.
  - **Sticky teal header** — shows current month label + unbilled count badge + refresh button.
  - **Skeleton loader** — shimmer placeholders while data loads (4 stacked blocks).
  - **`UnbilledAlert`** — expandable amber banner. Lists each unaccounted vehicle-month with Ignore / Restore actions. Turns green when all items are ignored.
  - **`KpiStrip`** — 2×2 grid of KPI cards: This Month billed, This FY total, Active WOs, Expiring WOs (accent amber when count > 0).
  - **`VehicleRevenueChart`** — Chart.js horizontal bar chart (top 10 vehicles). Toggles between current month and current FY. Unbilled vehicles shown as grey bars.
  - **`WoFlags`** — list of WOs with expiry warnings (⏰) or utilisation warnings (📊). Red at ≤7 days / ≥95%, amber otherwise.
  - **`MonthlyTrendChart`** — Chart.js vertical bar chart for last 6 months. Current month highlighted in gold, past months in teal. MoM delta badge (▲/▼ %) in header. Stat pills: monthly average + peak month.
  - **`StatPill`** — reusable pill sub-component for avg/peak summary.

- `app/src/ui/AppShell.tsx` — added 🏠 Home as tab index 0. Default active tab changed from `invoices` to `home`.

### Fixed

- `DashboardPage.tsx` — `inv.totalInvoiceAmount` renamed to `inv.totalAmount` to match `dashboardDb.ts` type.
- `DashboardPage.tsx` — Restore button used undefined CSS var `--color-info`; corrected to `--color-primary`.

### Changed

- `dashboardDb.ts` — Replaced `RecentInvoice` type + `fetchRecentInvoices()` with `MonthlyTrend` type + `fetchMonthlyTrend()`. Recent invoices are already accessible in the Invoices tab; the dashboard bottom slot is better used for a billing trend chart.

### Observations

- `vehicle_billing_ledger` was purpose-built during Phase 3 for analytics — all four dashboard data queries read from it directly with no joins, making the dashboard extremely fast.
- Chart.js is loaded from CDN on first render (lazy `<script>` inject). Both charts share the same CDN script — `MonthlyTrendChart` checks for an existing `<script>` tag before injecting a second one to avoid double-loading.
- Unbilled detection covers current + previous month only. Checking further back would produce false positives for vehicles that were legitimately idle. The ignore mechanism handles legitimate gaps.
- The `near_limit` WO flag threshold is 80% of contracted value. This is a soft warning — the WO is not blocked, just flagged. 95% triggers red (error colour).

---

## [2026-06-01] — Cancel Invoice + Edit Finalised Invoice + InvoicesPage Redesign

### Added

- `supabase/migrations/008_decrement_billed_qty_rpc.sql` — New SQL RPC.
  - `decrement_billed_qty(p_item_id, p_qty)` decrements `cumulative_billed_qty` on `work_order_items` by the given qty.
  - Uses `greatest(0, ...)` clamp to prevent negative values under any prior data inconsistency.
  - ⚠️ Must be run manually in Supabase SQL Editor before the Cancel button works.

- `app/src/db/invoicesDb.ts` — `cancelInvoice(invoiceId)`.
  - Validates invoice exists and is `status = 'final'`.
  - Calls `_reverseBilledQty(invoiceId)` to undo quantity tracking on all affected `work_order_items`.
  - Calls `_reverseVehicleLedger(invoiceId)` to delete the invoice's rows from `vehicle_billing_ledger`.
  - Updates invoice `status → 'cancelled'`.
  - Returns typed `{ ok: true } | { ok: false, error: string }`.

- `app/src/db/invoicesDb.ts` — `_reverseBilledQty(invoiceId)` (private helper).
  - Mirror image of `_updateBilledQty()` called at finalization — runs the same math in reverse.
  - **Quantity invoices:** reads `invoice_line_items` → calls `decrement_billed_qty` RPC per item.
  - **Rental invoices:** reads `invoice_item_distribution` → converts `allocated_amount ÷ rate` back to qty equivalent → calls `decrement_billed_qty` RPC per distribution row.

### Fixed

- `app/src/ui/invoices/InvoiceWizard.tsx` — Next → button was hidden when editing a final invoice.

### Changed

- `app/src/ui/invoices/InvoicesPage.tsx` — Full redesign: teal header, FY selector, status filter pills, VOID stamp on cancelled cards, auto-tab switch on cancel, `InvoiceCard` extracted.

### Observations

- The `existingStatus !== 'final'` guard in `InvoiceWizard` was subtle — it looked intentional (hiding Save Draft) but had a hidden side effect (hiding Next too).
- Rental and quantity billing types are both handled by `_reverseBilledQty`.

---

## [2026-06-01] — Draft/Final UI Split + Draft Delete

### Added
- `deleteDraftInvoice(invoiceId)` in `invoicesDb.ts`.

### Changed
- `InvoicesPage.tsx` — split into Drafts (top) and Finalised (bottom) sections. Two-step inline delete confirmation on draft cards.

---

## [2026-06-01] — Invoice Identity Fix (Draft → Final same row)

### Fixed
- `saveDraftInvoice()` + `finalizeInvoice()` — now accept `existingInvoiceId` to UPDATE in-place.
- `useInvoiceDraft.ts`, `InvoiceWizard.tsx`, `InvoicesPage.tsx`, `Section4Review.tsx` — threaded `savedInvoiceId` through the entire flow.

---

## [2026-06-01] — TDS Calculation Fixes (3 Bugs) + Invoice Rollback

### Fixed
- TDS base corrected to `total_taxable` everywhere (`Section4Review`, `buildInvoicePayload`, `InvoiceWizard`).

---

## [2026-06-01] — PDF Layout Fixes

### Fixed
- Header overlap, logo size, description indent, gold separator row position in `InvoicePdf.tsx`.

---

## [2026-05-31] — PDF Layout Fixes (Session 2) + Bug Fixes

### Fixed
- Additional PDF layout fixes. TDS always 0% bug (3 root causes). Invoice date billing period auto-recalculation. PDF font CDN URLs.

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
