# Architecture

> Updated as the project evolves. If something here contradicts the code, the code wins — update this file.

***

## Project Overview

- **Project name:**
- **What it does (one sentence):**
- **App type:** (Desktop / Web / Mobile)
- **Primary user:**

***

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| UI Framework | | |
| Language | | |
| Desktop Shell | | |
| Database | | |
| PDF Generation | | |
| AI Integration | | |
| Testing | | |

***

## Module Map

```
project-root/
├── src/
│   ├── core/          # Domain logic — business rules, validations
│   ├── db/            # Database schema, migrations, queries
│   ├── ui/            # Screens and components
│   ├── pdf/           # PDF template and generation
│   └── integrations/  # AI service, external APIs
├── docs/              # This folder
└── scripts/           # Workflow helper scripts
```

***

## Module Responsibilities

### `core/`
- What lives here:
- What it must NOT do:
- Key concepts (entities, services):

### `db/`
- What lives here:
- Main tables / schemas:
- Migration strategy:

### `ui/`
- What lives here:
- Screens list:
- Component naming convention:

### `pdf/`
- What lives here:
- Template approach:
- How generation is triggered:

### `integrations/`
- What lives here:
- Each integration and its wrapper:

***

## Data Flow

> How data moves from user action → processing → storage → display.

```
[User Action]
  → [UI Component]
  → [Core / Domain function]
  → [DB / Storage]
  → [UI update]
```

***

## Key Constraints and Rules

- (Add your project-specific rules here)
- (e.g.) IDs must be unique within a given scope
- (e.g.) Certain fields are user-overridable but auto-detected by default

***

## Layer Boundaries

| Layer | Can call | Cannot call |
|---|---|---|
| UI | core/, integrations/ | db/ directly |
| core/ | db/ | ui/ |
| integrations/ | core/ | db/ directly |
| db/ | — | anything else |

***

## Current Known Gaps / Open Questions

- (Things not yet decided or implemented)
