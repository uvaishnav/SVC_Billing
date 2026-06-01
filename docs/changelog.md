# Changelog

> Most recent entries first. Keep the last 15 entries.

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
  - `TdsRow` was receiving `totalAmount={draft.total_amount}` and computing live preview TDS as `totalAmount × tdsRate / 100`. Since `total_amount` includes GST, the displayed TDS figure in the review screen was inflated.
  - Fix: Added separate `taxableAmount` prop receiving `draft.total_taxable`. TDS preview now uses `taxableAmount × tdsRate / 100`. The `totalAmount` prop is retained only for the `net_receivable` display line.

- `app/src/ui/invoices/pdf/buildInvoicePayload.ts` — **TDS rate back-derivation used wrong denominator (`total_amount` → `total_taxable`).**
  - When loading a saved/finalized invoice for PDF generation, `tds_rate` was back-derived as `(tds_amount / total_amount) × 100`, producing a smaller, wrong rate printed in the PDF label.
  - Fix: Changed denominator from `totalAmount` to `totalTaxable`.

- `app/src/ui/invoices/InvoiceWizard.tsx` — **Rental TDS always 0 in PDF preview (root cause: `setRentalItems` never triggered `recomputeTotals`).**
  - `setRentalItems` was passed raw from the wizard to `Section2Items` — it only updated `draft.rental_items` but never called `recomputeTotals`. As a result, `draft.total_taxable`, `tds_amount`, and `net_receivable` stayed at `0` throughout the entire rental wizard flow.
  - Fix: Replaced raw `setRentalItems` pass-through with `handleSetRentalItems` wrapper that calls `recomputeTotals` immediately after updating items.

### Data Recovery (Manual — Supabase SQL)

- Invoice `id=6` was finalized accidentally before the sequence was reset, receiving number `SVC/26-27/003` instead of the intended `SVC/26-27/001`.
- All finalization side effects were manually rolled back via SQL:

  | Side Effect | Rollback SQL |
  |---|---|
  | Invoice status | `UPDATE invoices SET status='draft', invoice_number='DRAFT-6' WHERE id=6` |
  | Sequence counter | `UPDATE settings SET current_sequence=0 WHERE id=1` |
  | Vehicle ledger row | `DELETE FROM vehicle_billing_ledger WHERE invoice_id=6` |
  | WO item 18 billed qty | `UPDATE work_order_items SET cumulative_billed_qty=0 WHERE id=18` |

### Observations
- The rental TDS bug was the most subtle: `quantity` invoices were unaffected because `setLineItems` sets `taxable_value` per item so `total_taxable` is always non-zero before Section 4 mounts. Rental items have no per-item taxable value — the subtotal is only meaningful after `recomputeTotals` runs on the full list.
- TDS rule enforced everywhere: `TDS = tds_rate% × total_taxable` — never on `total_amount` which includes GST.

---

## [2026-06-01] — PDF Layout Fix 4: Gold Separator Row Position

### Fixed
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — Taxable Value row gold border moved from top to bottom.
  - Removed `borderTopWidth: 1`, `borderTopColor: '#C8B89A'`, and `marginTop: 2` from `tableTaxableRow` style.
  - Added `borderBottomWidth: 1`, `borderBottomColor: '#C8B89A'` to the same style.
  - The gold line now seals the table below Taxable Value: header → data rows → **Taxable Value** → gold line → totals section.

---

## [2026-05-31] — PDF Layout Fixes (Session 2)

### Fixed
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — Header overlap fix: `lineHeight: 1.0` and `marginBottom: 4` on `headerBusinessName`.
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — Logo size: `LOGO_SIZE` bumped to `100`.
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — Description indent: removed `paddingHorizontal: 10` from `descBlock`.

---

## [2026-05-31] — Bug Fix: TDS Always Showing 0% (3 Root Causes)

### Fixed
- `app/src/ui/invoices/Section1Header.tsx` — Bug 1: `emptyDraft()` init guard changed from `=== undefined` to `!draft.work_order_id`; TDS from settings applied unconditionally on fresh drafts.
- `app/src/ui/invoices/Section1Header.tsx` — Bug 2: new `useEffect` on WO selection reads `tds_applicable` flag and applies `default_tds_rate` from cached settings.
- `app/src/ui/invoices/Section4Review.tsx` — Bug 3: always-visible `<TdsRow>` replacing the `tds_rate > 0` gated block; inline editable rate picker.

---

## [2026-05-31] — Analysis: AI Description Quality Gap — Rental vs Quantity

### Identified (Not Yet Fixed)
- Root cause 1: `line_items` is always `[]` for rental → `work_item_descriptions` sent to Edge Function is empty.
- Root cause 2: `SYSTEM_INSTRUCTION_RENTAL` is too vague and passive.
- Root cause 3: No fallback instruction when `work_item_descriptions` is empty.
- Three planned fixes deferred to a future session.

---

## [2026-05-31] — Bug Fix: Invoice Date → Billing Period Auto-Recalculation

### Fixed
- `app/src/ui/invoices/useInvoiceDraft.ts` — `prevMonthRange()` accepts optional `baseDate` param and is now exported.
- `app/src/ui/invoices/Section1Header.tsx` — `handleInvoiceDateChange()` auto-fills `billing_from`/`billing_to` relative to selected invoice date. `parseLocalDate()` helper avoids UTC-midnight IST shift.

---

## [2026-05-31] — PDF Font CDN Fix

### Fixed
- `app/src/ui/invoices/pdf/InvoicePdf.tsx` — All 6 `Font.register()` URLs updated to correct Fontsource jsDelivr CDN scheme (`cdn.jsdelivr.net/fontsource/fonts/{font}@{version}/{subset}-{weight}-{style}.ttf`).

---

## [2026-05-30] — PDF Invoice Generation — Part 3: PDF Rendering

### Added
- Complete `@react-pdf/renderer` document component, payload types, utilities, data assembler, preview modal, actions component, PDF storage DB helpers, and migration 007.

### Design Decisions Made
- `@react-pdf/renderer` over jsPDF (vector output, JSX layout).
- Portrait A4, dual-axis color (tax mode × billing type), SAC chip standalone, description above line items.

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
