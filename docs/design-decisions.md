# Design Decisions

> One entry per decision. Format: `[YYYY-MM-DD] For [area] — chose X over Y because Z.`
> Update, don't append, when a decision is revised.

---

## Deployment & PWA

**[2026-06-02] For hosting — chose Cloudflare Pages over Vercel.**
The app is a pure static Vite SPA with all backend work delegated to Supabase. Vercel's main advantage (serverless/Edge functions) is unused. Cloudflare Pages offers unlimited bandwidth (vs Vercel's 100 GB/month cap), 300+ CDN PoPs including multiple Indian cities (Hyderabad, Mumbai, Bangalore) vs Vercel's single Mumbai node, and zero-friction domain setup because the domain DNS is already managed in Cloudflare.

**[2026-06-02] For PWA setup — chose manual manifest + handcrafted service worker over `vite-plugin-pwa`.**
`vite-plugin-pwa`'s auto-generated precaching would cache Supabase API responses and auth tokens, causing stale-auth bugs after deployments. A manual `sw.js` gives explicit control: cache-first for Vite hashed `/assets/` and the static shell only; network-only for all Supabase calls (any URL containing `supabase.co` or `supabase.io`). No new runtime dependencies added.

**[2026-06-02] For iOS home screen icons — PNG required, SVG not used.**
iOS Safari ignores SVG for `apple-touch-icon`. All three PWA icon files (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) must be rasterised PNGs. The `favicon.svg` remains for desktop browser tabs where SVG is supported and renders crisply.

---

## Dashboard

**[2026-06-01] For dashboard navigation — chose a dedicated 🏠 Home tab (tab index 0) over embedding the dashboard inside the Invoices tab or as a pre-shell screen.**
The app already has `overflowX: auto` on the tab bar, so a 7th tab scrolls cleanly on mobile. A dedicated tab makes the dashboard a first-class destination the user intentionally navigates to, rather than a surprise interstitial. It also keeps the Invoices tab focused on invoice CRUD without a mixed dashboard+list layout.

**[2026-06-01] For unbilled vehicle detection — check current month AND previous month only (not further back).**
Checking further back produces false positives for vehicles that were legitimately idle (e.g. a vehicle added mid-year that had no WO in earlier months). Two months is the practical window a billing operator needs to catch missed invoices. The Ignore mechanism handles legitimate gaps explicitly.

**[2026-06-01] For the dashboard bottom section — chose a 6-month billing trend chart over a recent invoices list.**
Recent invoices are already accessible in the Invoices tab — duplicating them on the dashboard adds no new information. A billing trend chart answers "is my billing volume healthy?" — a question that can only be answered with time-series context. The `vehicle_billing_ledger` table was purpose-built for this aggregation.

**[2026-06-01] For the vehicle revenue chart — chose Chart.js (CDN) horizontal bar over pure SVG bars.**
Chart.js provides tooltips, responsive resize, and accessible canvas rendering with ~zero implementation cost via CDN. Pure SVG would require manual tooltip and resize logic. The CDN is loaded lazily on first Dashboard render only; if the user never visits the Dashboard tab, zero bytes are loaded.

**[2026-06-01] For WO near-limit threshold — 80% triggers amber warning, 95% triggers red.**
At 80% the operator has likely 1–2 billing cycles left before the WO is exhausted. This gives enough lead time to raise a new WO with the client before billing is blocked. 95% is red because at that point the next invoice will almost certainly exceed the contracted value.

---

## Invoice Cancellation

**[2026-06-01] For invoice cancellation — chose two-step inline confirmation over a modal.**
The first tap reveals a warning panel + "Yes, void invoice" / "Keep it" directly on the card.
This avoids context switching while still requiring deliberate user intent for a destructive action.

**[2026-06-01] For cancelled invoice sequence numbers — do not decrement `current_sequence`.**
Cancelled invoice numbers must not be reused. Gaps in numbering for voided invoices are expected
and auditable under GST. `current_sequence = 2` after cancelling invoice 002 is correct — the next
new invoice will be 003, not 002.

**[2026-06-01] For InvoicesPage FY filter — drafts assigned to current FY.**
Drafts have no `invoice_date` until finalization. Assigning them to current FY is a pragmatic
default. Known limitation: a draft created in March and finalized in April (new FY) will briefly
disappear from view after finalization until the user switches FY. Acceptable for now.

---

## Invoice Wizard

**[2026-06-01] For draft-to-final promotion — UPDATE the same row in-place rather than INSERT a new row.**
The `id` is the permanent identity of an invoice. Upsert-by-invoice_number failed because `DRAFT-{ts}` and `SVC/25-26/001` are different keys — finalization was treated as a new INSERT, orphaning the draft row. One invoice = one `invoices` row forever; `invoice_number` is a mutable label.

**[2026-06-01] For TDS calculation base — always use `total_taxable`, never `total_amount`.**
`total_amount` includes GST. TDS is deducted from the taxable base before GST. Using `total_amount` overcalculates TDS. This rule is enforced in `Section4Review` (preview), `buildInvoicePayload` (PDF), and `finalizeInvoice` (DB write).

---

## Invoice PDF

**[2026-05-30] For PDF rendering — chose `@react-pdf/renderer` over `jsPDF` + `html2canvas`.**
`@react-pdf/renderer` produces vector PDF with real text (selectable, searchable, copy-pasteable). `html2canvas` rasterizes the DOM — output is a flat image inside a PDF, not a real document. For a GST invoice that clients will receive, print, and archive, vector text is non-negotiable.

**[2026-05-26] For invoice layout — compliance-first section structure.**
11 sections locked to match GST Tax Invoice requirements: supplier details, buyer details, vehicle/WO reference, line items, taxable value, GST breakdown (CGST+SGST or IGST), total, TDS, net receivable, bank details, declaration.

---

## Work Orders

**[2026-05-24] For WO parsing — OCR (Tesseract.js) + AI (Edge Function) prefill over manual entry.**
Work orders arrive as scanned PDFs/images. Manual re-entry of contract values, dates, and vehicle lists is error-prone and slow. OCR extracts raw text; the AI edge function structures it into the WO schema. The user reviews and corrects — human stays in the loop.

---

## Data Architecture

**[2026-05-28] For rental billing analytics — maintain `vehicle_billing_ledger` as a denormalized write-through cache.**
A normalised query joining `invoices → invoice_rental_items → vehicles` across hundreds of invoices is expensive and complex. Writing one row per vehicle per invoice into `vehicle_billing_ledger` at finalization time makes all billing history queries O(1) table scans. The tradeoff is that cancellation must reverse these rows — handled by `_reverseVehicleLedger()` in `cancelInvoice()`.

---

## Navigation & Shell

**[2026-05-22] For tab navigation — bottom tab bar with overflow scroll.**
Mobile-first. Bottom tabs are within thumb reach. Overflow scroll handles the growing tab count (currently 7) without collapsing into a hamburger menu which would hide the primary navigation.

---

## Auth

**[2026-05-20] For auth — Supabase magic link + session persistence.**
Single-user PWA used by one operator. Magic link removes password management burden. Supabase session is persisted in localStorage — user stays logged in across app restarts.
