# Design Decisions

> One entry per decision, most recent first.
> Format: `[YYYY-MM-DD] For [area] — chose X over Y because Z.`

---

## [2026-05-31] For TDS init in `Section1Header` — apply settings default unconditionally on fresh drafts, not behind `=== undefined` guard

`emptyDraft()` initialises `tds_rate = 0` (a valid number, not `undefined`), so the old guard `if (draft.tds_rate === undefined)` was always false and settings were silently ignored. The fix removes the type-check guard and instead uses a semantic guard: `if (!draft.work_order_id)` — meaning "this is a fresh draft with no WO context, so apply the global default". The WO-selection effect is responsible for overriding it once a WO is linked. This preserves the correct priority order: global settings → WO override → user manual edit.

## [2026-05-31] For TDS on WO selection — WO's `tds_applicable` flag overrides global setting, uses global `default_tds_rate` as the rate

The WO knows *whether* TDS applies (via its `tds_applicable` boolean), but does not store its own TDS rate — that is a business-level setting unlikely to change per WO. Design: WO flag sets the on/off, global `default_tds_rate` provides the rate. The `cachedTdsRate` + `cachedTdsApplicable` pattern (storing settings values in component state after initial load) avoids a second DB call in the WO-selection effect, which runs on every WO dropdown change.

## [2026-05-31] For TDS in Section 4 Review — always-visible inline-editable row, not hidden behind `tds_rate > 0`

Hiding TDS when it is 0% left users with no way to diagnose or correct a misconfigured TDS rate before finalising. The new `<TdsRow>` component is always visible as a read-display + tap-to-edit pattern. The rate is shown as a tappable pill (e.g. "2% ✏️"); tapping replaces it with a number input (0–30%). On blur or Enter, `recomputeTotals()` is called and the full draft is patched. Net Receivable only appears when TDS > 0 to avoid showing a redundant line at 0%. Chosen over: (a) a separate TDS settings screen, (b) TDS field in Section 1 only — those both require leaving the review screen.

## [2026-05-31] For AI description quality gap (rental invoices) — root cause is empty `work_item_descriptions` + vague system prompt, not model quality

Quantity invoices populate `work_item_descriptions` from `line_items[].description` — rich text that gives the AI strong narrative hooks. Rental invoices always produce `line_items = []`, so the array is empty every time. The system prompt's "if provided" clause tells the AI to skip it entirely. Fix strategy: (1) add a Work Description field in Section 2 rental form as the rental-mode equivalent of line item descriptions; (2) rewrite `SYSTEM_INSTRUCTION_RENTAL` to be directive ("write as a single flowing professional sentence") not passive ("describe which vehicles were deployed"); (3) add explicit fallback instruction in `buildGeneratePrompt()` when descriptions are empty. These are prompt/UI changes only — no schema changes required.

---

## [2026-05-30] For PDF preview in Section 4 — use `usePdfPreview` hook + Supabase-hosted URL, not inline `PDFViewer`

`PDFViewer` from `@react-pdf/renderer` renders an iframe with an object URL. In the mobile WebView (Capacitor/PWA), iframes are unreliable and the PDF generation blocks the main thread for large invoices. The `usePdfPreview` hook generates the PDF blob, uploads it to Supabase Storage, and returns a signed URL. Section 4 opens the URL in a full-screen modal iframe. On mobile, the modal is replaced with a direct download prompt. This pattern also means the PDF is stored in Supabase and accessible later without regeneration.

## [2026-05-30] For PDF font registration — `.ttf` from Fontsource CDN, not `.woff2` or system fonts

`@react-pdf/renderer` fetches font bytes via HTTP and decodes them internally. It supports `.ttf` and `.otf` only — `.woff2` is not supported. Fontsource CDN (`cdn.jsdelivr.net/fontsource/fonts/`) provides `.ttf` for all weights. System fonts cannot be used as they are not available at the Supabase Edge Function runtime (where server-side PDF generation may run in future). Chosen fonts: Inter (body, 400/500/600/700) + Lora (display headings, 400/700).

## [2026-05-30] For PDF layout — dual-axis color system (tax mode × billing type)

Two independent axes affect the visual identity of the invoice:
- **Tax mode axis** (CGST+SGST vs IGST): drives the accent color — warm gold for intra-state, cool steel blue for inter-state. This signals the tax regime to the reader at a glance.
- **Billing type axis** (quantity vs rental): drives the table header background — parchment/amber for quantity (familiar invoice look), cool blue-grey for rental (equipment/fleet feel).
Chosen over a single fixed color scheme because the dual axis adds meaningful visual information without adding cognitive load.

## [2026-05-28] For rental billing sub-form — vehicle rows with billing_mode toggle (full_month / partial_days), not a single "rental amount" field

Rental invoices from RSV Constructions always involve multiple vehicles, each potentially on different billing modes (some full month, some partial days due to deployment start date). A single "rental amount" input would require manual calculation and offer no audit trail. Vehicle rows with mode toggle + auto-subtotal computation give transparent math and map directly to the `invoice_rental_items` schema, which is needed for the `vehicle_billing_ledger` debit entries.

## [2026-05-28] For AI description generation — separate system instructions per billing type (`SYSTEM_INSTRUCTION_QUANTITY` vs `SYSTEM_INSTRUCTION_RENTAL`)

Quantity and rental invoices have structurally different data (line item descriptions vs vehicle deployment lists) and require different narrative styles. A single generic prompt produced poor output for rental invoices. Separate system instructions allow rental-specific constraints (no per-day rate language, vehicle-centric narrative, deployment period phrasing) without polluting the quantity prompt.

## [2026-05-28] For rental billing — `invoice_item_distribution` table for work order allocation, not a single `work_order_id` FK on the rental item

Rental vehicles are often shared across multiple work orders in a month (e.g. a tipper works 10 days on WO-A and 5 days on WO-B). A single `work_order_id` FK cannot represent this. The distribution table stores `(invoice_id, work_order_id, allocation_pct, allocated_amount)` with a 100% sum constraint enforced client-side. This also enables the future "WO utilisation" analytics view.

## [2026-05-27] For invoice wizard — 4-section linear wizard (not a single long form or tabs)

Invoice creation involves 4 distinct concern areas (header, items, description, review) with strong sequential dependencies (billing type in §1 drives item form in §2; items drive AI description in §3; all drive totals in §4). Linear wizard enforces this order and prevents "partially filled" states where the user jumps ahead. Section completion is not gated (user can navigate back freely) but the wizard's visual flow guides the natural order.

## [2026-05-27] For invoice draft state — single `useInvoiceDraft` hook with `patch()` updater, not per-section local state

With 4 sections all editing the same `InvoiceDraft` object, per-section local state would require lifting state up or using context. A single hook with a `patch(partial)` updater gives all sections direct write access to the draft with one source of truth. The hook also owns draft persistence (`saveDraftInvoice`) and `recomputeTotals`, keeping financial math centralised.

## [2026-05-26] For invoice face — TDS shown as informational summary below GST total, not as a GST-level field

TDS is not a GST concept — it is an income tax deduction made by the client at payment time. Showing TDS alongside CGST/SGST/IGST would imply it is a tax collected by the supplier, which is legally incorrect. TDS is placed as a subtraction line below "Total Invoice Amount" with a note "(deducted by client)" to make the flow: taxable → GST → invoice total → minus TDS → net receivable.

## [2026-05-26] For invoice face — no project name or vehicle list in the printed invoice body

Project name and vehicle list are internal operational records. Indian GST invoice compliance requires: supplier details, buyer details, invoice number/date, SAC code, description of services, taxable value, GST breakdown, total. Vehicle lists are referenced in work orders, not invoices. Including them adds noise and risks customer confusion. They remain in the app's internal data model only.

## [2026-05-24] For work order reference — use `wo_reference` (free-text), not an auto-generated `wo_number`

Work orders come from clients (RSV Constructions) who assign their own WO numbers (e.g. "RSV/WO/2025-26/0042"). An internal auto-generated number would conflict with the client's reference. `wo_reference` is a nullable free-text field — the user types the client's WO number if one exists. The internal `id` (PK) is used for all FK relationships.

## [2026-05-24] For WO status computation — client-side `computeWOStatus()`, not a DB trigger or generated column

WO status (draft / active / completed / closed) is derived purely from existing fields (`start_date`, `end_date`, `status` override). A DB trigger would add infrastructure complexity and make testing harder. A client-side pure function is zero-infrastructure, testable in isolation, and always consistent with the UI's view of the data.

## [2026-05-23] For settings — single `app_settings` row (typed columns), not a key-value store

A key-value store (`key TEXT, value JSONB`) loses type safety and requires runtime casting for every read. The settings surface is small and well-defined (business profile, bank defaults, TDS defaults). A single typed row with NOT NULL defaults gives compile-time safety, IDE autocomplete, and simpler queries. `patchSettings()` uses `UPDATE ... SET col = COALESCE($1, col)` to allow partial updates without NOT NULL violations.

## [2026-05-23] For client GSTIN management — `client_gstins` child table, not columns on `clients`

A client operating in multiple states has one GSTIN per state registration. Storing GSTINs as columns (`gstin_ap`, `gstin_tn`, ...) or a JSONB array loses relational integrity and makes querying by GSTIN impossible. A `client_gstins` child table (with `state`, `state_code`, `gstin`, `address`) normalises this correctly and supports future features like state-wise revenue reporting.
