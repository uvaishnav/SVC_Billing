# Design Decisions

> One entry per significant decision. Format: `[YYYY-MM-DD] For [area] — chose X over Y because Z.`
> If a decision is later revised, update the original entry and add a note below it.

***

## [2026-05-23] Settings Module — Single-row typed table

Chose a **single-row typed table** (`settings`, always `id = 1`) over a key-value store (`key TEXT, value TEXT`) because:
- All settings fields are known upfront from the PRD
- Type safety is critical for financial fields (`default_tds_rate NUMERIC`, `current_sequence INTEGER`)
- A key-value store would require runtime string parsing, risking silent bugs in invoice calculations

## [2026-05-23] Settings Module — Separate `bank_accounts` table

Chose a **separate `bank_accounts` table** (one row per account) over hardcoding `bank1_*` / `bank2_*` columns in `settings` because:
- Hardcoding a fixed count is bad practice — the business may add more accounts in future
- Each account has a `nickname` field used for dropdown selection in the invoice wizard
- `settings.default_bank_account_id` FK pre-selects the most-used account in the wizard
- Soft-delete (`is_active = false`) preserves history without breaking invoice FK references

## [2026-05-23] Settings Module — Separate `sac_codes` table

Chose a **separate `sac_codes` table** over a single default SAC field in settings because:
- The business uses multiple SAC codes (997319 for equipment rental, 9954 for construction)
- Each code has a `nickname` for human-friendly dropdown selection in the invoice wizard
- `settings.default_sac_id` FK pre-selects the default; user overrides per invoice as needed
- Pre-seeded with known codes at DB setup; user can add more without code changes

## [2026-05-23] Settings Module — `patchSettings` vs `upsertSettings`

Introduced two separate functions for writing to `settings`:
- `upsertSettings(values)` — used for full profile saves; does INSERT or UPDATE with all required fields
- `patchSettings(values)` — used for partial updates (e.g. set default bank, set default SAC); pure `UPDATE WHERE id = 1`

This separation prevents `NOT NULL` constraint violations when only a single field needs updating.

***

## [2026-05-23] Clients Module — Address belongs on `client_gstins`, not `clients`

Chose to store `address` (and `state`, `state_code`) on the **`client_gstins` table** rather than on `clients` because:
- A client registered in multiple states has a **different registered address per GST registration**
- Storing address on `clients` would require picking one arbitrarily, which is incorrect for multi-state clients
- The `clients` table now holds identity-only data: `name`, `phone`, `email`, `is_active`
- Each `client_gstins` row is a complete, self-contained GST registration: `gstin`, `state`, `state_code`, `address`, `is_primary`

**Impact on invoices:** When generating an invoice, fetch the specific `client_gstins` row the user selects — it provides the recipient address and GSTIN to print on the invoice. Do NOT read address from the `clients` table.

## [2026-05-23] Clients Module — `GstinDraft` pattern for form state

Chose a **single `GstinDraft` object** (with `commitDraft()` + `setGstins()` list) over separate disconnected state variables because:
- Separate variables caused race conditions on re-render — values were not atomically captured
- A single draft object is reset atomically on commit, preventing stale state bugs
- All `+ Add` buttons must carry `type="button"` explicitly — omitting this causes browser form-submit behaviour

## [2026-05-23] Clients Module — Auto-promote primary on GSTIN removal

When the primary GSTIN is removed from the list, the system automatically promotes the first remaining GSTIN to primary.

## [2026-05-23] Clients Module — UI design language: inline CSS + CSS variables only

Chose **inline CSS with CSS variables** over Tailwind utility classes for all UI components.
**Rule for all future modules:** Import from `settings/_components.tsx`, use CSS variables, no Tailwind classes on UI components.

## [2026-05-23] AppShell — Nav overlap fix

Fixed bottom tab bar covering page content: scrollable area has `paddingBottom: 64px`, tab bar is `position: fixed`.
**Rule for all future pages:** Never set `min-height: 100svh` on a page root. Use `min-height: 100%`.

## [2026-05-23] Clients Module — `upsertClientGstin` requires `onConflict`

Always pass `{ onConflict: 'col1,col2' }` when upserting into any table with a composite unique constraint. See Supabase Rule 3.

***

## [2026-05-24] Vehicles Module — Lean identity-focused schema

Chose a **flat `vehicles` table with no unit/rate fields** (except `default_monthly_rent`) because unit-based billing rates are work-order-driven, not vehicle-driven. See changelog 2026-05-24 Vehicles for full rationale.

***

## [2026-05-24] Invoice Numbering — Atomic Postgres RPC over optimistic frontend increment

Chose **atomic `UPDATE...RETURNING` via Postgres RPC** to prevent duplicate invoice numbers across concurrent devices. See changelog 2026-05-24 Invoice Numbering for full rationale.

## [2026-05-24] Invoice Numbering — `last_fy` TEXT column over computed-only FY detection

Chose to **store `last_fy` as TEXT on `settings`** so the Postgres function can detect FY change in the same atomic transaction.

***

## [2026-05-24] Work Orders — `wo_reference` over `wo_number` (deviation from PRD)

The PRD schema (Section 21.5) uses `wo_number`. We use **`wo_reference`** because:
- Real work orders from RSV Constructions use labels like "LC-14", "LC-150" — these are references, not sequential numbers
- "number" implies auto-generated or sequential; "reference" correctly conveys a client-assigned label
- This naming is more accurate for the actual data the user will enter

## [2026-05-24] Work Orders — Extra columns `rates_firm`, `tds_applicable`, `billing_type` (addition to PRD)

Added three columns not in the PRD schema because:
- PRD Sections 10.4 and 11.1 explicitly describe these as important work-order attributes
- `rates_firm` — all sample WOs state "rates are firm, no escalation"; needed for the rate-override warning in invoice creation
- `tds_applicable` — determines whether TDS deduction appears on invoices linked to this WO
- `billing_type` (`monthly_ra` / `milestone` / `adhoc`) — determines the invoice creation flow for this WO
- Storing these avoids having to re-read the WO PDF or ask the user each time an invoice is created

## [2026-05-24] Work Orders — `sub_work_ref` column on `work_order_items` (addition to PRD)

Added `sub_work_ref` (e.g. "SW:1", "SW:2") because:
- Real work order samples from the business use sub-work references within a single WO
- Needed for item disambiguation in the invoice line description builder (next session)
- PRD schema omitted it because it was not known at PRD writing time

## [2026-05-24] Work Orders — Client-side status computation via `computeWOStatus()`

Chose to **compute `status` client-side** on every fetch rather than storing it or using a DB trigger because:
- Status is a function of `valid_to` vs today — it changes daily without any DB write
- A stored column would become stale unless a cron job or trigger kept it updated
- `computeWOStatus()` is a pure function — always correct, zero infrastructure cost
- DB `status` column is only written by explicit `closeWorkOrder()` calls (the one status that CAN'T be derived from dates)

## [2026-05-24] Work Orders — Replace-on-save for `work_order_items`

Chose **delete-all + re-insert** for saving work order items over differential update (detect added/removed/changed rows) because:
- The WO form shows all items at once; user edits the full list, not individual rows
- Differential diffing requires stable row IDs on the frontend, which adds complexity
- Delete + re-insert is atomic and always correct; the window of "no items" is milliseconds inside a single function call
- cumulative_billed_qty is preserved because it is not exposed in the edit form — the replace only re-inserts items with `cumulative_billed_qty: 0` for new WOs; for edits, the existing items already carry their qty in the loaded form state

> ⚠️ **Important caveat:** Once invoices start updating `cumulative_billed_qty` on items, the replace-on-save strategy must be revisited. At that point, editing a WO's items must NOT reset billed quantities. This decision should be re-evaluated when the invoice creation module is built.

## [2026-05-24] Work Orders — AI parsing via Supabase Edge Function, not direct API call

For the upcoming OCR + AI parsing flow (Part 2), chose to route the AI parsing call through a **Supabase Edge Function (`parse-work-order`)** rather than calling OpenAI/Gemini directly from the browser because:
- Calling AI APIs from the browser exposes the API key in client-side code — unacceptable security risk
- Edge Function can validate the JWT, rate-limit, and handle API key rotation without frontend changes
- Same pattern already established by `generate-invoice-number` Edge Function
- Only the AI API key needs to be set via `supabase secrets set OPENAI_API_KEY ...`

## [2026-05-24] Work Orders — OCR runs in-browser via Tesseract.js

For the upcoming PDF-to-text extraction step, chose **Tesseract.js in-browser OCR** over server-side OCR because:
- PRD Section 23.2 explicitly specifies Tesseract.js as the OCR library
- Work order PDFs are typically clean scanned documents — Tesseract accuracy is sufficient
- Running in-browser avoids uploading large PDFs to a server before extraction; only the extracted text is sent to the AI
- PDF → text extraction happens before the Supabase Storage upload (upload only happens after user confirms the parsed data)

***

## [2026-05-26] PDF Invoice Generation — Compliance-first invoice face (deviation from PRD Section 8.2 item 6)

Chose a **stripped-down, compliance-first invoice face** over the PRD's fuller project-reference block layout because:

- **No project name / subject on invoice:** Project name and work order subject are internal records only. The invoice face should describe the taxable supply, not the internal project taxonomy. Printing a long subject line clutters the bill without adding GST-required information.
- **No explicit vehicle block on invoice:** Vehicle selection is used for internal analytics, usage tracking, and description assistance only. Vehicles may optionally appear inside the AI-generated description text when contextually relevant, but they will not appear as a separate printed section.
- **W.O. Reference printed in low-emphasis style:** When a work order is linked, its reference (e.g. "W.O. Ref: LC-14") is printed in a muted, small-text style in the invoice metadata block. This aids client-side reconciliation without dominating the invoice face.
- **TDS as informational summary line (not a GST field):** TDS (@ 2% on taxable value) is shown below the GST-inclusive invoice total as: `TDS @ 2% (deducted by client): ₹X` and `Net Receivable: ₹Y`. This is not a mandatory GST field but is operationally essential for the business to set payment expectations with the client.
- **Multi-row line items:** Each billed work-order item gets its own row (Sl. No, Description, SAC, Unit, Qty, Rate, Taxable Value). A single consolidated tax row appears at the bottom. This keeps per-item traceability intact.

**Locked invoice section structure:**
1. Header band — supplier identity (name, address, GSTIN, PAN, phone/email, logo)
2. Invoice metadata — invoice number, date, billing period, W.O. reference (muted)
3. Bill-to block — client name, address, GSTIN, place of supply + state code, tax mode, reverse charge
4. Line items table — Sl. No / Description / SAC / Unit / Qty / Rate / Taxable Value
5. Totals block — total taxable, CGST+SGST or IGST, **total invoice amount** (bold), TDS informational line, net receivable
6. Amount in words
7. Bank details — bank name, account name, account number, IFSC, branch
8. Declaration + authorized signatory name + signature line

***

## [2026-05-28] Rental Billing — Separate `invoice_rental_items` table over nullable columns on `invoice_line_items`

Chose a **separate `invoice_rental_items` table** (Option B) over adding nullable `billing_mode`, `num_days`, `monthly_rent` columns to the existing `invoice_line_items` table because:
- Rental rows have fundamentally different fields — they don't have `unit`, `qty`, or per-unit `rate`; instead they have `billing_mode`, `num_days`, and `monthly_rent`
- Adding these as nullable columns to `invoice_line_items` would result in a wide, sparse table where one set of columns is always NULL depending on billing type — a classic "mixed entity" anti-pattern
- Separate tables keep both schemas lean and explicit; the correct child table to query is determined by `invoices.line_item_billing_type`
- PDF renderer, invoice totals, and API joins all benefit from knowing exactly which table to read without conditional logic

## [2026-05-28] Rental Billing — `line_item_billing_type` column on `invoices`, not inferred from child tables

Chose to **store `line_item_billing_type TEXT NOT NULL DEFAULT 'quantity'`** explicitly on the `invoices` table rather than inferring billing type by checking whether `invoice_rental_items` or `invoice_line_items` rows exist because:
- PDF renderer needs the billing type at render time — a single column read is cleaner and faster than a child-table existence check
- Querying child tables to infer type is fragile: a newly created invoice with no items yet would be mis-classified
- Future reporting queries (`WHERE line_item_billing_type = 'rental'`) are simpler and indexable
- Explicit is always better than inferred for data that drives layout decisions

## [2026-05-28] Rental Billing — `invoice_item_distribution` table for rental-to-WO-item allocation

Chose a **separate `invoice_item_distribution` table** to map rental invoice totals back to work order items rather than skipping `cumulative_billed_qty` tracking for rental invoices because:
- Work Order detail sheet shows utilisation bars per item — these must stay accurate for rental invoices too
- Without distribution, the WO utilisation tracking would be blind to all rental billing, making the "contracted vs billed" view meaningless for rental-heavy work orders
- Distribution is user-adjustable (default: equal split) so the business can reflect actual work allocation per sub-item
- Distribution table is rental-only; quantity invoices track allocation implicitly via `invoice_line_items.work_order_item_id`

## [2026-05-28] Rental Billing — Monthly rent formula: `(monthly_rent / 30) × num_days` for partial billing

Chose a **fixed 30-day divisor** for partial-month billing rather than actual calendar days in the billing month because:
- The business uses a fixed daily rate derived from monthly rent — the divisor 30 is an agreed commercial convention, not calendar arithmetic
- Using actual calendar days (28/29/30/31) would produce inconsistent daily rates month-to-month, making invoices harder to explain to the client
- The formula `(monthly_rent / 30) × num_days` is simple, predictable, and client-friendly
- `NUMERIC` division (not integer) must be used in SQL; TypeScript must use `number` (never `Math.floor` on intermediate result)

## [2026-05-28] AI Description — No per-day rate language for rental invoices

Chose to **exclude per-day rate phrasing** (e.g. "₹X/day") from AI-generated descriptions for rental invoices because:
- The business charges a monthly rent (or a prorated fraction of it) — the unit of the contract is the month, not the day
- Stating a daily rate in the description would misrepresent the billing basis to the client and create confusion during reconciliation
- Rental descriptions should be vehicle-and-period-focused: e.g. "JCB 3DX (KA-01-AB-1234) deployed at site for the full month of May 2026"
- This rule applies even for partial-day billing — the description states the number of days worked, not the implied daily rate

***

## [2026-05-30] PDF Rendering — `@react-pdf/renderer` over jsPDF

Chose **`@react-pdf/renderer`** over jsPDF + html2canvas for invoice PDF generation because:
- jsPDF requires manual coordinate math (x, y, w, h) for every element — table layout becomes brittle and hard to maintain
- html2canvas produces a rasterized screenshot inside a PDF — blurry at print resolution, fails the print quality requirement
- `@react-pdf/renderer` produces fully vector PDFs (text, lines, borders) via PDFKit — identical print sharpness to jsPDF but with a Flexbox-based JSX layout model
- Layout is expressed as React components with `StyleSheet.create({})` (React Native style API) — far more maintainable than coordinate math
- Custom TTF fonts (Playfair Display + Work Sans) can be embedded directly for brand consistency
- The existing React codebase makes component-based PDF layout a natural fit
- **Note:** `@react-pdf/renderer` cannot use Tailwind classes — all styles are inline `StyleSheet.create()` objects. This is acceptable since the PDF is a standalone document component.

## [2026-05-30] PDF Rendering — Portrait A4 orientation

Chose **Portrait A4** over Landscape for all invoice types because:
- GST tax invoices in India follow a universal portrait A4 standard — landscape would appear non-standard to clients and tax authorities
- All invoice data (3–8 quantity line items or 2–6 rental vehicle rows) fits comfortably in portrait layout with the chosen column structure
- Portrait prints correctly on all office printers and renders properly when shared via WhatsApp/email on mobile
- Landscape would waste vertical space and make the document feel like a spreadsheet, not a legal document

## [2026-05-30] PDF Rendering — Dual-axis color differentiation system

Chose a **dual-axis subtle color system** to visually distinguish invoice types without breaking brand identity:

**Axis 1 — Tax Mode (drives accent rule + SAC code chip background):**
- `cgst_sgst` → Gold accent `#C8A96A` / chip bg `#FFF8ED` (warm — intra-state, domestic)
- `igst` → Steel blue accent `#4A7FA5` / chip bg `#EEF4FA` (cool — inter-state)

**Axis 2 — Billing Type (drives table header background):**
- `quantity` → Parchment `#EDE9DE` (warm earthy — materials/services)
- `rental` → Cool blue-grey `#E8EEF2` (cool — machinery/fleet)

**Invariant brand elements (never change across any combination):**
- Page background: `#FFFFFF`
- Company name: `#3B2A1F` (espresso brown) in Playfair Display
- Body text: `#2A1F15`
- Totals highlight row: `#3B2A1F` bg + `#FAF8F3` text
- Header band: `#FAF8F3` (cream — logo sits without masking on any background)

All 4 combinations (Qty+CGST, Qty+IGST, Rental+CGST, Rental+IGST) use only desaturated, muted tones so no combination feels out of place from the brand identity.

## [2026-05-30] PDF Rendering — SAC code as standalone chip, not embedded in description

Chose to render the **SAC code as a visually distinct chip/badge** (its own row with tinted background between the Bill To block and the description section) rather than mentioning it inside the description text or as a column in the line items table because:
- SAC is a statutory classification code under GST — it has independent legal significance separate from the service description
- Repeating the SAC code on every line item row is redundant when all items on one invoice share the same SAC code (enforced by the wizard's single SAC selector)
- A dedicated chip draws attention to the code as a standalone GST field, making it easy for the client's accounts team to verify classification without reading the description
- Chip shows only the numeric code (e.g. `996601`) — no nickname/description — keeping it clean and unambiguous
- Chip background uses the tax-mode accent tint (gold or blue) to tie into the dual-axis color system

## [2026-05-30] PDF Rendering — Invoice number as prominent right-aligned bordered box in document identity band

Chose to give the invoice number a **prominent bordered call-out box** in a dedicated "document identity" band (below the header, above the two-column details section) rather than inline metadata text because:
- Invoice number is the primary reference used by both parties for reconciliation, payment tracking, and GST filing — it deserves visual hierarchy
- A bordered box with larger Playfair Display type makes it scannable at a glance, even when printed and stacked with other invoices
- Centering "TAX INVOICE" with the invoice number box right-aligned in the same band creates a professional document identity row without wasting vertical space
- Compliance requirement (Rule 46(b)): invoice number must be clearly visible — a prominent box satisfies this more robustly than small inline text

## [2026-05-30] PDF Rendering — Supplier identity in header band, not a separate labelled section

Chose to place **all supplier details (logo, name, address, GSTIN, PAN, phone, email, state+code) in the header band** rather than a labelled "SUPPLIER" section below it because:
- Premium Indian B2B invoices (Tata, L&T, Infosys) universally place supplier identity in the letterhead/header — it is visually implied, not labelled
- A separate "SUPPLIER" label below the header is redundant — the header IS the supplier identity
- This frees vertical space for the two-column Invoice Details + Bill To layout below
- Logo on cream background (`#FAF8F3`) renders correctly for any PNG logo without requiring a dark background

## [2026-05-30] PDF Rendering — Description of Services above the line items table

Chose to place the **AI-generated overall description above the line items table** (between the SAC chip and the table) rather than in the footer area because:
- The description contextualises the line items — placing it before the table lets the reader understand the service scope before reviewing individual amounts
- It mirrors how professional service invoices are structured: description of engagement → itemised billing
- Footer area is reserved for amount-in-words and bank details — adding a long text block there would push bank details off-page on invoices with many line items

## [2026-05-30] PDF Rendering — Work Items Covered block for rental invoices only

Chose to include a **"Work Items Covered Under This Billing Period"** informational block (below the rental vehicle table) for rental invoices only because:
- `invoice_item_distribution` data (WO item descriptions + allocation percentages) exists specifically for rental invoices and is meaningless to exclude from the document
- It provides the client's accounts team with context on what the hired machinery was supporting — important for project cost allocation on the client side
- This block is strictly informational (not a GST mandatory field) and is clearly labelled as such
- Quantity invoices do not need this block — each line item already maps directly to a WO item via `work_order_item_id`
