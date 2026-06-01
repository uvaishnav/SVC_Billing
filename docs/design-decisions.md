# Design Decisions

> One entry per meaningful decision. Most recent first. Format: `[YYYY-MM-DD] For [area] — chose X over Y because Z.`

---

## [2026-06-01] For invoice list UI — split drafts and finals into two labelled sections rather than a unified sorted list

Chose to render two visually separate sections ("DRAFTS" on top, "FINALISED INVOICES" below) over a single list with status chips for sorting/filtering.

**Rationale:** Drafts and finals have completely different actions available — drafts are editable and deletable; finals are read-only with a PDF button. Mixing them in one list forces the user to scan for status chips to understand what they can do. Separating them makes the available actions self-evident at a glance. The amber left-border accent on draft cards also creates immediate visual distinction without relying on text labels alone.

**Trade-off:** When there are many finals and no drafts, the "DRAFTS" section disappears, which is fine. When both exist, drafts always appear on top (higher priority action surface).

---

## [2026-06-01] For draft deletion — two-step inline confirmation over a modal dialog

Chose an inline "Delete draft? [Yes, delete] [Cancel]" confirmation rendered directly in the card over a modal dialog or a separate confirm screen.

**Rationale:** A modal for a single destructive action on a list item is disproportionate — it breaks visual context and requires a full overlay. An inline confirmation is localized to the card being acted on, keeps the rest of the list visible, and resolves in one additional tap without navigation. The `e.stopPropagation()` call ensures the confirmation interaction does not accidentally trigger the card's edit flow.

**Trade-off:** Inline confirmations are slightly less discoverable than a modal with a warning icon, but deletion of drafts is a low-stakes action (no finalization side effects have occurred) so a lightweight pattern is appropriate.

---

## [2026-06-01] For invoice DB identity — UPDATE by `id` over UPSERT by `invoice_number`

Chose `UPDATE invoices SET ... WHERE id = ?` for all re-saves (both draft re-saves and draft-to-final promotion) over the original `UPSERT ... ON CONFLICT (invoice_number)`.

**Rationale:** `invoice_number` changes from `DRAFT-{timestamp}` to the real sequential number (e.g. `SVC/26-27/001`) at finalization. An upsert keyed on `invoice_number` therefore treats every finalization as a new INSERT (the old draft key and the new final key are different), leaving the original draft row orphaned in the DB with `status='draft'`. The fix: capture the `id` on the first INSERT and use it as the stable identity for all subsequent mutations. The `id` never changes; only the mutable label (`invoice_number`) and state (`status`) change.

**Implementation:** `saveDraftInvoice` returns `{ invoice, savedId }`. `useInvoiceDraft` stores `savedInvoiceId` in state and threads it through to `Section4Review` via `InvoiceWizard`. `finalizeInvoice` checks for `existingInvoiceId` and branches between UPDATE and INSERT accordingly.

---

## [2026-06-01] For draft deletion safety — status-check guard before any DB mutation

Chose to SELECT and verify `status === 'draft'` before executing any DELETE in `deleteDraftInvoice()` over trusting the caller to pass only draft ids.

**Rationale:** The delete button is only rendered for draft cards in the UI, but the DB function is a public export that could be called from anywhere (future features, tests, console). A server-side guard is the correct place for the invariant: "only drafts can be hard-deleted." Finalized invoices must go through `cancelInvoice()` (which reverses ledger entries) — hard-deleting a final invoice would leave `vehicle_billing_ledger` and `work_order_items.cumulative_billed_qty` stale.

---

## [2026-05-31] For TDS calculation base — always use `total_taxable`, never `total_amount`

Chose `total_taxable` (pre-GST amount) as the denominator for all TDS computations — in `TdsRow` preview, in `buildInvoicePayload.ts` back-derivation, and in `recomputeTotals()` — over `total_amount` (which includes GST).

**Rationale:** Under Indian income-tax law (Section 194C/194J), TDS is deducted on the invoice value *before* GST. Using `total_amount` inflates the TDS figure and the back-derived rate. This is both legally incorrect and produces wrong amounts on the PDF.

---

## [2026-05-31] For TDS visibility in Section 4 — always-visible inline editable row over conditional rendering

Chose to always render `<TdsRow>` in Section 4 Review regardless of whether `tds_rate` is 0, over the original `{tds_rate > 0 && ...}` conditional.

**Rationale:** If the TDS row is hidden at 0%, the user has no way to set a TDS rate after the WO auto-fill runs, without going back to Section 1. The review screen is the last checkpoint before finalization; it must expose all financially significant fields. `<TdsRow>` shows the rate as a tappable pill that opens an inline number input — low visual noise at 0%, fully editable when needed.

---

## [2026-05-31] For rental `recomputeTotals` trigger — wrapper function in wizard over direct state setter pass-through

Chose to wrap `setRentalItems` in a `handleSetRentalItems` function inside `InvoiceWizard` that calls `recomputeTotals()` immediately after updating items, over passing the raw `setRentalItems` to `Section2Items`.

**Rationale:** `recomputeTotals` must run whenever the rental item list changes so `total_taxable`, `tds_amount`, and `net_receivable` stay current. Passing raw `setRentalItems` bypassed this, leaving totals at 0 for the entire rental wizard flow. The wrapper is the single authoritative place to enforce "items changed → recompute totals" without requiring `Section2Items` to know about the totals computation.

---

## [2026-05-30] For PDF engine — `@react-pdf/renderer` (JSX/vector) over jsPDF + html2canvas (canvas/raster)

Chose `@react-pdf/renderer` for invoice PDF generation over jsPDF + html2canvas.

**Rationale:** `@react-pdf/renderer` produces vector PDFs via JSX layout (similar to React Native's Flexbox model). jsPDF + html2canvas rasterizes the DOM, resulting in blurry text at high zoom, large file sizes, and fragile layout dependencies on the live DOM. For a compliance document like a GST invoice, vector output with precise typography is mandatory.

**Trade-off:** `@react-pdf/renderer` cannot use CSS variables or Tailwind — all styles are `StyleSheet.create()` objects. This is acceptable because PDF rendering is a separate concern from the app UI.

---

## [2026-05-30] For PDF color system — dual-axis (tax mode × billing type) over single accent

Chose a dual-axis color scheme for the invoice PDF: tax mode drives the primary accent (gold `#C8B89A` for CGST/SGST intra-state, steel blue `#5B7FA6` for IGST inter-state), and billing type drives the table header background (parchment for quantity, cool blue-grey for rental).

**Rationale:** The two axes carry distinct semantic meaning. Tax mode indicates the GST jurisdiction — a compliance distinction that affects which tax lines appear. Billing type affects the table structure itself. Color-coding both makes the invoice type immediately recognizable at a glance, which is useful when reviewing a stack of invoices.

---

## [2026-05-28] For rental invoice distribution — equal-split default with manual override

Chose to auto-fill `invoice_item_distribution` with an equal split (total ÷ number of WO items, remainder cent on first item) as the default, with each row manually adjustable.

**Rationale:** In practice, most rental invoices split across WO items evenly. The equal-split default eliminates manual entry for the common case while remaining fully editable for exceptions. A live 100% sum guard prevents accidental over/under-allocation.

---

## [2026-05-27] For invoice numbering — atomic Postgres RPC with FY-aware sequence

Chose a Supabase Postgres RPC (`generate_invoice_number`) with `SERIALIZABLE` isolation over application-level sequence generation.

**Rationale:** Application-level generation under concurrent requests can produce duplicate sequence numbers. The RPC locks the `settings` row, increments `current_sequence`, and returns the formatted number atomically. FY-awareness is enforced in the function: the sequence resets to 1 at the start of each financial year (April 1).

---

## [2026-05-27] For wizard navigation — section-based with sticky progress bar over full page routing

Chose a 4-section in-page wizard with a sticky `WizardNav` progress bar over separate routes per section.

**Rationale:** Invoice creation is a single transaction — navigating away mid-wizard should not lose state. In-page sections keep the draft in React state throughout, eliminating the need for route-level state persistence. The sticky progress bar gives users a clear sense of position and allows jumping between sections without URL changes.

---

## [2026-05-26] For invoice layout — compliance-first section order

Chose to structure the PDF invoice as: header → tax invoice stamp → supplier + customer details → SAC chip → description of services → line items → totals → amount in words → bank details → declaration.

**Rationale:** This order matches the GST invoice format prescribed under Rule 46 of CGST Rules 2017. Compliance fields (GSTIN, place of supply, SAC) appear before financial data. The declaration and signature block closes the document as legally required.

---

## [2026-05-24] For WO PDF parsing — in-browser Tesseract.js OCR + Edge Function AI over server-side OCR

Chose Tesseract.js (in-browser OCR) feeding extracted text to a Supabase Edge Function for AI field extraction, over a fully server-side OCR + AI pipeline.

**Rationale:** Keeping OCR in-browser avoids uploading potentially sensitive WO PDFs to a server for OCR. Only the extracted text (not the raw PDF bytes) is sent to the Edge Function. The Edge Function holds the AI API key and performs field extraction, keeping secrets out of the client bundle.
