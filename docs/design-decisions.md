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

## [2026-05-23] Clients Module — Separate `client_gstins` table

Chose a **separate `client_gstins` table** (one row per GSTIN) over a JSONB array on the `clients` row because:
- Invoice generation needs to look up "which GSTIN for this client in state X" — a relational join is cleaner and indexable
- Each GSTIN has metadata (state, state_code, is_primary) that is awkward to manage inside a JSONB blob
- Soft-insert/delete per GSTIN without touching the parent client row keeps audit trails clean

## [2026-05-23] Navigation Shell — Built alongside Clients module

Chose to introduce a **bottom-tab nav shell (`AppShell`)** at the same time as the Clients module, rather than continuing to hardcode a single page in `App.tsx`, because:
- Two navigable modules now exist (Settings + Clients); hardcoding one page is no longer viable
- Vehicles Master is the very next feature — building the shell now avoids a disruptive refactor
- The shell is intentionally minimal (2 tabs) and new tabs are a one-line addition per feature going forward
