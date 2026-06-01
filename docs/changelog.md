# Changelog

> Most recent entries first. Keep the last 15 entries.

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
  - **Root cause:** The condition `existingStatus !== 'final'` wrapped the entire bottom bar, hiding both Save Draft and Next → for final invoices. Only Save Draft should be hidden (to prevent demoting a final to draft).
  - **Fix:** Extracted `isEditingFinal` flag. Save Draft is conditionally rendered with `{!isEditingFinal && <SaveDraftBtn />}`. Next → is always rendered regardless of `existingStatus`.

### Changed

- `app/src/ui/invoices/InvoicesPage.tsx` — Full redesign to match `WorkOrdersPage.tsx` UX pattern.
  - **Teal sticky header** — teal `var(--color-primary)` background, Playfair Display title, subtitle showing `FY XX-XX • N finalised`, circle `+` button top-right.
  - **Financial Year selector** — scrollable pill row auto-derived from `invoice_date` of all invoices. Current FY always present. Defaults to current FY on load. Draft invoices (no finalized date) assigned to current FY.
  - **Status filter pills** — four tabs with live count badges scoped to selected FY:
    - Finalised ✅ (default on landing)
    - Drafts 📝
    - Cancelled 🚫
    - All 📋
  - **Sorted by invoice number descending** — numeric suffix extraction handles formatted numbers like `SVC/25-26/003`.
  - **VOID stamp** — semi-transparent diagonal overlay on cancelled cards (opacity 0.18, pointer-events none).
  - **Auto-tab switch on cancel** — after cancelling an invoice, view switches to Cancelled tab automatically.
  - **`InvoiceCard` extracted** — card rendering extracted into a standalone component for cleaner separation of concerns. Handles all three statuses with conditional action rows.

### Design Decisions

- **[2026-06-01] For invoice cancellation — chose two-step inline confirmation over a modal.**
  The first tap reveals a warning panel + "Yes, void invoice" / "Keep it" directly on the card.
  This avoids context switching while still requiring deliberate user intent for a destructive action.

- **[2026-06-01] For cancelled invoice sequence numbers — do not decrement `current_sequence`.**
  Cancelled invoice numbers must not be reused. Gaps in numbering for voided invoices are expected
  and auditable under GST. `current_sequence = 2` after cancelling invoice 002 is correct — the next
  new invoice will be 003, not 002.

- **[2026-06-01] For InvoicesPage FY filter — drafts assigned to current FY.**
  Drafts have no `invoice_date` until finalization. Assigning them to current FY is a pragmatic
  default. Known limitation: a draft created in March and finalized in April (new FY) will briefly
  disappear from view after finalization until the user switches FY. Acceptable for now.

### Observations

- The `existingStatus !== 'final'` guard in `InvoiceWizard` was subtle — it looked intentional
  (hiding Save Draft) but had a hidden side effect (hiding Next too). This class of
  "overly broad boolean condition" is worth watching for in other wizard sections.
- Rental and quantity billing types are both handled by `_reverseBilledQty` — the function reads
  `line_item_billing_type` from the DB first and then takes the correct path. This mirrors the
  exact same branching logic in `_updateBilledQty`, making the reverse path a reliable inverse.

---

## [2026-06-01] — Draft/Final UI Split + Draft Delete

### Added
- `app/src/db/invoicesDb.ts` — `deleteDraftInvoice(invoiceId: number)` function.
  - First verifies `status === 'draft'` by fetching the row; returns `{ ok: false, error }` immediately if the invoice is not a draft — finalized invoices cannot be deleted through this path, only cancelled.
  - Deletes all 4 child tables in order (`invoice_line_items`, `invoice_vehicles`, `invoice_rental_items`, `invoice_item_distribution`) before deleting the parent row to satisfy FK constraints.
  - Returns `{ ok: true }` on success or `{ ok: false, error: string }` on DB failure.

### Changed
- `app/src/ui/invoices/InvoicesPage.tsx` — Invoice list split into two separate visual sections:
  - **Drafts** (top): section label "DRAFTS — N" with horizontal rule. Each card has an amber left border (`var(--color-warning)`), tap-to-edit behaviour, and a 🗑 delete button in the top-right corner. The delete button is a two-step inline confirmation: first tap shows "Delete draft? [Yes, delete] [Cancel]" — no modal, no page navigation. Deletion is optimistic (row removed from local state immediately; DB call runs in background).
  - **Finalised Invoices** (bottom): section label "FINALISED INVOICES — N" with horizontal rule. Cards are non-clickable (`cursor: default`). Status badge (green for final, red for cancelled) shown top-right. `InvoiceActions` (View/Download PDF button) rendered inline on each card.

### Observations
- `e.stopPropagation()` on the delete button is essential — without it, clicking delete also triggers the card's `onClick` (open wizard) event, causing a confusing state transition.
- Optimistic removal gives instant feedback with no flicker; the full `load()` is not called on delete, avoiding a list re-sort.
- The `InvoiceActions` component already existed with `if (status === 'draft') return null` — wiring it into the Finalised section required zero changes to `InvoiceActions` itself.

---

## [2026-06-01] — Invoice Identity Fix (Draft → Final same row)

### Fixed
- `app/src/db/invoicesDb.ts` — `saveDraftInvoice()` and `finalizeInvoice()` both accept a new optional `existingInvoiceId?: number | null` parameter.
  - When provided: uses `UPDATE ... WHERE id = ?` — the same DB row is promoted in-place from draft to final. The `invoice_number` and `status` columns change; the `id` (and all FK references from child tables) stay the same.
  - When null/undefined: falls back to the old `upsert by invoice_number` path — safe for the very first save of a brand-new draft.
  - `saveDraftInvoice` now returns `{ invoice, savedId }` (was `Invoice | null`) so callers can capture the auto-assigned `id` from the first INSERT and use it for all subsequent saves and the final promote.

- `app/src/ui/invoices/useInvoiceDraft.ts` — new `savedInvoiceId` state, initialised from optional `initialInvoiceId` prop.
  - `saveDraft()` now passes `savedInvoiceId` to `saveDraftInvoice()`, captures the returned `savedId`, and stores it — so the **second and all further saves** of the same session UPDATE the correct row.
  - Exposes `savedInvoiceId` for the wizard to pass down to Section 4.

- `app/src/ui/invoices/InvoiceWizard.tsx` — new `existingInvoiceId` prop.
  - Passes it as `initialInvoiceId` to `useInvoiceDraft`.
  - Passes the live `savedInvoiceId` (from hook) to `Section4Review` as `existingInvoiceId` — so even a newly created draft that was saved mid-wizard carries the correct id into the finalize step.

- `app/src/ui/invoices/InvoicesPage.tsx` — new `editInvoiceId` state.
  - `openInvoice()` sets `editInvoiceId = inv.id` when loading a draft for editing.
  - Passes `existingInvoiceId={editInvoiceId}` to `<InvoiceWizard>`.
  - Clears `editInvoiceId` on `closeWizard()`.

- `app/src/ui/invoices/Section4Review.tsx` — new `existingInvoiceId` prop.
  - `handleFinalize()` passes it to `finalizeInvoice()` to select the UPDATE path.

### Observations
- The previous upsert-by-invoice_number approach failed because `DRAFT-{timestamp}` → `SVC/26-27/001` is a different key, so the upsert treated finalization as a new row INSERT, leaving the original draft row orphaned in the DB with `status='draft'` and `invoice_number='DRAFT-...'`.
- The invariant now enforced: **one draft = one `invoices` row, forever**. The `id` is the permanent identity; `invoice_number` is a mutable label on that row.
- Existing invoices edited from the list correctly carry their `id` through the entire wizard flow without any new INSERT.

---

## [2026-06-01] — TDS Calculation Fixes (3 Bugs) + Invoice Rollback

### Fixed

- `app/src/ui/invoices/Section4Review.tsx` — **TDS preview used wrong base (`total_amount` → `total_taxable`).**
- `app/src/ui/invoices/pdf/buildInvoicePayload.ts` — **TDS rate back-derivation used wrong denominator (`total_amount` → `total_taxable`).**
- `app/src/ui/invoices/InvoiceWizard.tsx` — **Rental TDS always 0 in PDF preview (root cause: `setRentalItems` never triggered `recomputeTotals`).**

### Observations
- TDS rule enforced everywhere: `TDS = tds_rate% × total_taxable` — never on `total_amount` which includes GST.

---

## [2026-06-01] — PDF Layout Fix 4: Gold Separator Row Position

### Fixed
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — Taxable Value row gold border moved from top to bottom.

---

## [2026-05-31] — PDF Layout Fixes (Session 2)

### Fixed
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — Header overlap fix, logo size bump, description indent removed.

---

## [2026-05-31] — Bug Fix: TDS Always Showing 0% (3 Root Causes)

### Fixed
- `Section1Header.tsx` — init guard + WO selection TDS apply.
- `Section4Review.tsx` — always-visible TdsRow + inline editable rate.

---

## [2026-05-31] — Bug Fix: Invoice Date → Billing Period Auto-Recalculation

### Fixed
- `useInvoiceDraft.ts` + `Section1Header.tsx` — billing period auto-fills on invoice date change.

---

## [2026-05-31] — PDF Font CDN Fix

### Fixed
- `InvoicePdf.tsx` — All 6 `Font.register()` URLs updated to correct Fontsource jsDelivr CDN scheme.

---

## [2026-05-30] — PDF Invoice Generation — Part 3: PDF Rendering

### Added
- Complete `@react-pdf/renderer` document component, payload types, utilities, data assembler, preview modal, actions component, PDF storage DB helpers, and migration 007.

---

## [2026-05-28] — Invoice Wizard — Phase 3 Parts 1–2 (Rental Billing + AI Description)

### Added
- Migration 006, rental billing DB schema, Section 2 rental sub-form, Section 3 description + AI, `generate-invoice-description` Edge Function.

---

## [2026-05-27] — Invoice Wizard — Phase 3 Part 1 (Wizard Shell + Section 1 Header)

### Added
- Invoice tab, `InvoicesPage`, `InvoiceWizard`, `WizardNav`, `useInvoiceDraft`, `Section1Header`, `Section4Review`, `invoicesDb`, `invoiceNumberingDb`.

---

## [2026-05-26] — Invoice Face Design

### Added
- Compliance-first invoice section structure locked in `design-decisions.md`.

---

## [2026-05-24] — Work Orders Module — Part 2 (OCR + AI Parse)

### Added
- OCR + AI-prefill mode, `parse-work-order` Edge Function, Tesseract.js.
