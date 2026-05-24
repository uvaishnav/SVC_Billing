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

Chose a **single `GstinDraft` object** (with `commitDraft()` + `setGstins()` list) over separate disconnected state variables (`newGstin`, `newState`, `newAddress`) because:
- Separate variables caused race conditions on re-render — values were not atomically captured
- A single draft object is reset atomically on commit, preventing stale state bugs
- The `commitDraft()` function validates all three required fields before adding to the list
- All `+ Add` buttons must carry `type="button"` explicitly — omitting this causes browser form-submit behaviour that wipes state

## [2026-05-23] Clients Module — Auto-promote primary on GSTIN removal

When the primary GSTIN is removed from the list (either in the form or via delete), the system automatically promotes the first remaining GSTIN to primary:
- Prevents invoices from having no primary GSTIN to bill to
- Persisted immediately via `setPrimaryGstin()` if the promoted entry already has a DB `id`
- If it's a new (unsaved) entry, `is_primary: true` is written on the next `handleSave()` call

## [2026-05-23] Clients Module — UI design language: inline CSS + CSS variables only

Chose **inline CSS with CSS variables** (matching the Settings module) over Tailwind utility classes for all client UI components because:
- Settings module established the pattern; mixing Tailwind in clients created a visually inconsistent UI
- CSS variables (`--color-primary`, `--color-accent`, etc.) are the single source of truth for brand colours
- Shared primitives from `settings/_components.tsx` (`cardStyle`, `Field`, `PrimaryButton`, `inputStyle`, `labelStyle`, `sectionTitleStyle`) must be reused in all future modules — never redeclare these inline

**Rule for all future modules:** Import from `settings/_components.tsx`, use CSS variables, no Tailwind classes on UI components.

## [2026-05-23] AppShell — Nav overlap fix

Fixed bottom tab bar covering page content by:
- Wrapping page content in a scrollable `div` with `paddingBottom: 64px` (nav bar height)
- Tab bar is `position: fixed`, `zIndex: 100`
- Pages must NOT use `min-height: 100svh` on their root element — this causes content to paint behind the fixed nav
- **Rule for all future pages:** Never set `min-height: 100svh` on a page root. Use `min-height: 100%` instead. The AppShell handles full-height layout.

***

## [2026-05-23] Clients Module — `upsertClientGstin` requires `onConflict`

Supabase `.upsert()` on a table with a composite unique constraint (`client_id, gstin`) silently fails without `{ onConflict: 'client_id,gstin' }`. Always pass `onConflict` explicitly when upserting into any table that has a non-PK unique constraint. This applies to all future tables with composite unique keys.

***

## [2026-05-24] Vehicles Module — Lean identity-focused schema

Chose a **flat `vehicles` table with no unit/rate fields** (except `default_monthly_rent`) because:
- The business bills in two modes: unit-based (material transport) and monthly rental
- **Unit-based:** rate per CUM/TON is negotiated in the work order, not inherent to the vehicle. Storing it on the vehicle would be incorrect or stale.
- **Monthly rental:** the monthly rent amount is relatively stable per vehicle — worth storing as a nullable pre-fill hint for the invoice wizard
- `capacity` + `capacity_unit` describe the vehicle's physical spec (useful in AI-generated descriptions: "6 CUM Tipper No. AP39TC1234"), NOT billing figures
- All fields except `reg_number` are nullable — user fills incrementally; no capacity data required at creation time
- Soft-delete via `is_active = false` preserves future `invoice_vehicles` junction table FK references

***

## [2026-05-24] Invoice Numbering — Atomic Postgres RPC over optimistic frontend increment

Chose **atomic `UPDATE...RETURNING` via Postgres RPC** (`get_next_invoice_number`) over optimistic frontend increment because:
- Concurrent invoice creation must never produce duplicate numbers
- Postgres `FOR UPDATE` row lock serializes all calls at DB level — no two callers can get the same sequence number
- All business logic (FY detection, reset, formatting) lives in the Postgres function — easier to test, no network round-trips for the logic itself
- Edge Function is a thin authenticated HTTP wrapper; exponential backoff retry (4 attempts) handles the rare lock-timeout edge case

**Format chosen:** `{PREFIX}/{YY}-{YY+1}/{SEQ padded}` — e.g. `SVC/25-26/001`
- Resets to sequence = 1 every April 1 (new Financial Year)
- FY change detected by comparing computed current FY against `settings.last_fy` TEXT column inside the same atomic transaction
- GST Rule 46(b) compliant: max 16 chars, alphanumeric + `/` only

## [2026-05-24] Invoice Numbering — `last_fy` TEXT column over computed-only FY detection

Chose to **store `last_fy` as a TEXT column on `settings`** (e.g. `"25-26"`) rather than computing FY from `current_sequence` or a separate reset-date column because:
- The Postgres function needs a stored reference to compare against — "is the FY I computed right now different from the last time I ran?"
- A TEXT format (`"25-26"`) is human-readable directly in the DB and trivially comparable with `IS DISTINCT FROM`
- Reset happens in the same atomic transaction as the increment — zero chance of a gap or double-reset
