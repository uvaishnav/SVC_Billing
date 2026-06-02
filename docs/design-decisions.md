# Design Decisions

> One entry per decision. Format: `[YYYY-MM-DD] For [area] — chose X over Y because Z.`
> Update, don't append, when a decision is revised.

---

## Deployment & PWA

**[2026-06-02] For hosting — chose Cloudflare Pages over Vercel.**
The app is a pure static Vite SPA with all backend work delegated to Supabase. Vercel's main advantage (serverless/Edge functions) is unused. Cloudflare Pages offers unlimited bandwidth (vs Vercel's 100 GB/month cap), 300+ CDN PoPs including multiple Indian cities (Hyderabad, Mumbai, Bangalore) vs Vercel's single Mumbai node, and zero-friction domain setup because the domain DNS is already managed in Cloudflare. The decision was re-evaluated (originally Vercel was in the docs) after analysing the actual codebase and use case.

**[2026-06-02] For PWA setup — chose manual manifest + handcrafted service worker over `vite-plugin-pwa`.**
`vite-plugin-pwa`'s auto-generated precaching would cache Supabase API responses and auth tokens, causing stale-auth bugs after deployments. A manual `sw.js` gives explicit control: cache-first for Vite hashed `/assets/` and the static shell only; network-only for all Supabase calls (any URL containing `supabase.co` or `supabase.io`). No new runtime dependencies added.

**[2026-06-02] For iOS home screen icons — PNG required, SVG not used.**
iOS Safari ignores SVG for `apple-touch-icon`. All three PWA icon files (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) must be rasterised PNGs. The `favicon.svg` remains for desktop browser tabs where SVG is supported and renders crisply.

**[2026-06-02] For build CI — declare all imports in `package.json`, never rely on transitive installs.**
`pdfjs-dist` and `tesseract.js` were imported in `ocrPdf.ts` but absent from `package.json`. They installed transitively in local dev but failed on Cloudflare's clean environment. Rule: every `import` that is not from the standard library must have a matching entry in `dependencies` or `devDependencies`.

---

## Dashboard

**[2026-06-01] For dashboard navigation — chose a dedicated 🏠 Home tab (tab index 0) over embedding the dashboard inside the Invoices tab or as a pre-shell screen.**
The app already has `overflowX: auto` on the tab bar, so a 7th tab scrolls cleanly on mobile. A dedicated tab makes the dashboard a first-class destination the user intentionally navigates to, rather than a surprise interstitial. It also keeps the Invoices tab focused on invoice CRUD without a mixed dashboard+list layout.

**[2026-06-01] For unbilled vehicle detection — check current month AND previous month only (not further back).**
Checking further back produces false positives for vehicles that were legitimately idle. Two months is the practical window a billing operator needs to catch missed invoices. The Ignore mechanism handles legitimate gaps explicitly.

**[2026-06-01] For the dashboard bottom section — chose a 6-month billing trend chart over a recent invoices list.**
Recent invoices are already accessible in the Invoices tab. A billing trend chart answers "is my billing volume healthy?" — a question that can only be answered with time-series context. The `vehicle_billing_ledger` table was purpose-built for this aggregation.

**[2026-06-01] For the vehicle revenue chart — chose Chart.js (CDN) horizontal bar over pure SVG bars.**
Chart.js provides tooltips, responsive resize, and accessible canvas rendering with ~zero implementation cost via CDN. Pure SVG would require manual tooltip and resize logic. CDN loaded lazily on first Dashboard render only.

**[2026-06-01] For WO near-limit threshold — 80% triggers amber warning, 95% triggers red.**
At 80% the operator has ~1–2 billing cycles left. 95% is red because the next invoice will almost certainly exceed the contracted value.

---

## Invoice Cancellation

**[2026-06-01] For invoice cancellation — chose two-step inline confirmation over a modal.**
First tap reveals a warning panel + "Yes, void invoice" / "Keep it" directly on the card. Avoids context switching while still requiring deliberate intent for a destructive action.

**[2026-06-01] For cancelled invoice sequence numbers — do not decrement `current_sequence`.**
Cancelled invoice numbers must not be reused. Gaps in numbering for voided invoices are expected and auditable under GST.

**[2026-06-01] For InvoicesPage FY filter — drafts assigned to current FY.**
Drafts have no `invoice_date` until finalization. Assigning them to current FY is a pragmatic default. Known limitation: a draft created in March and finalized in April will briefly disappear until the user switches FY. Acceptable for now.

---

## Invoice Wizard

**[2026-06-01] For draft-to-final promotion — UPDATE the same row in-place rather than INSERT a new row.**
The `id` is the permanent identity of an invoice. Upsert-by-invoice_number failed because `DRAFT-{ts}` and `SVC/25-26/001` are different keys. One invoice = one `invoices` row forever; `invoice_number` is a mutable label.

**[2026-06-01] For TDS calculation base — always use `total_taxable`, never `total_amount`.**
`total_amount` includes GST. TDS is deducted from the taxable base before GST. Using `total_amount` overcalculates TDS. Enforced in `Section4Review`, `buildInvoicePayload`, and `finalizeInvoice`.

---

## Invoice PDF

**[2026-05-30] For PDF rendering — chose `@react-pdf/renderer` over `jsPDF` + `html2canvas`.**
`@react-pdf/renderer` produces vector PDF with real text (selectable, searchable, copy-pasteable). `html2canvas` rasterizes the DOM — output is a flat image inside a PDF. For a GST invoice, vector text is non-negotiable.

**[2026-05-26] For invoice layout — compliance-first section structure.**
11 sections locked to match GST Tax Invoice requirements.

---

## Work Orders

**[2026-05-24] For WO parsing — OCR (Tesseract.js) + AI (Edge Function) prefill over manual entry.**
Work orders arrive as scanned PDFs/images. OCR extracts raw text; the AI edge function structures it into the WO schema. The user reviews and corrects — human stays in the loop.

---

## Data Architecture

**[2026-05-28] For rental billing analytics — maintain `vehicle_billing_ledger` as a denormalized write-through cache.**
A normalised query joining `invoices → invoice_rental_items → vehicles` is expensive. Writing one row per vehicle per invoice at finalization makes all billing history queries fast. Cancellation reverses these rows via `_reverseVehicleLedger()`.

---

## Navigation & Shell

**[2026-05-22] For tab navigation — bottom tab bar with overflow scroll.**
Mobile-first. Bottom tabs are within thumb reach. Overflow scroll handles the growing tab count without collapsing into a hamburger menu.

---

## Auth

**[2026-05-20] For auth — Supabase magic link + session persistence.**
Single-user PWA used by one operator. Magic link removes password management burden. Supabase session persisted in localStorage — user stays logged in across app restarts.
