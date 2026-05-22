# GST Invoice & Work Order Billing App — Complete Project Documentation V3

## 1. Overview

This document defines the complete V3 specification for a billing application for **Sri Vaishnav Constructions**. The app is designed to generate **GST-compliant PDF tax invoices** for equipment and transport-related billing, manage work orders, assist with AI-powered description writing, support invoice editing with controlled PDF replacement, and provide an operational dashboard for vehicles, work orders, billing, and compliance monitoring.

The original V1 concept focused on Excel generation. The V2 direction moved to PDF-only invoices. **V3 further evolves the platform from a desktop Electron app to a mobile-first PWA**, making it usable daily from a smartphone while still delivering a full dashboard experience on desktop.

The system is intended for a small construction and rental business that currently raises monthly running bills for RSV Constructions and similar clients. The app must reduce manual work, avoid GST mistakes, organize work-order-linked billing, and improve internal control over rates, vehicles, billing periods, and invoice history.

***

## 2. Business Context

### 2.1 Business Profile

**Sri Vaishnav Constructions** is a small contractor / equipment rental business operated by **Uppalapati Surekha**, based in Godavarru, Kankipadu Mandal, Krishna District, Andhra Pradesh.

The business currently provides transport and related project support work, including:
- Tipper / dumper vehicle rental
- Aggregate and sand material transportation
- Earthwork and embankment-related support
- Granular sub-base / wet mix macadam-related transport or execution billing

### 2.2 Current Pain Points

The present billing process is manual and error-prone:
- Previous invoice files are copied and edited each month
- Dates, vehicle numbers, work descriptions, tax columns, and amounts are manually changed
- Work orders are not centrally linked to invoices
- Invoice descriptions are inconsistently typed
- Wrong GSTIN / Place of Supply / SAC code mistakes can happen
- There is no structured visibility into active work orders, rate usage, or vehicle-level billing
- Invoice revisions are hard to track cleanly

### 2.3 V3 Goal

The V3 app must:
- Generate **professional PDF invoices only**
- Remain GST-compliant
- Be fully usable from a **smartphone (iPhone)** for daily billing tasks
- Provide a **rich dashboard experience on desktop** for monthly reviews
- Link bills to uploaded work orders
- Extract structured work-order data from clean PDFs
- Pre-fill billable items and rates from valid work orders
- Warn on rate overrides and billing outside work-order validity
- Let the user edit invoices internally and regenerate the same invoice PDF in place
- Use AI to help create, improve, and simplify invoice descriptions
- Track vehicles, work orders, invoices, flags, and billing patterns on a dashboard
- **Sync data in real time across all devices** (iPhone, desktop, any browser)

***

## 3. Compliance Position

### 3.1 PDF-Only Invoices Are Acceptable

GST compliance in India is based on **mandatory invoice contents**, not on Excel as a required format. A valid tax invoice may be generated as PDF so long as all required fields under GST invoice rules are present, such as supplier details, recipient details, invoice number, date, description, taxable value, tax details, and place of supply.

Therefore, this app will generate **PDF invoices only**.

### 3.2 Editing Issued Invoices

The app may allow internal edits and regeneration of a PDF invoice. However, the internal system should distinguish between:
- **Draft invoices** — fully editable
- **Final invoices** — editable with warning and internal audit logging
- **Tax-impacting changes after issue** — should trigger warning recommending credit/debit note handling rather than silent correction, especially if values materially change

Invoice history and modification timestamps must be preserved for internal control.

***

## 4. Core Product Direction

### 4.1 Primary Output
- **Single output:** PDF tax invoice
- No Excel generation in V3
- Printable and shareable by WhatsApp / email from the app

### 4.2 Primary App Areas

The application consists of these major modules:
1. Dashboard
2. New Invoice / Bill Creation
3. Invoice History
4. Work Orders
5. Clients Master
6. Vehicles Master
7. Projects / Work References
8. Settings
9. AI Description Assistant
10. Flags / Alerts Center

### 4.3 Device Strategy

| Device | Primary Use | Experience |
|---|---|---|
| **iPhone (Mobile)** | Daily billing — create invoices, select work orders, generate PDFs, share via WhatsApp | Mobile-first UI: large tap targets, step-by-step wizard, bottom navigation bar |
| **Desktop / Laptop** | Monthly review — dashboard analytics, work order management, overall progress | Full-width layout with sidebar navigation, charts, and data tables |
| **Any Browser** | Fallback access | Same PWA, responsive at all screen sizes |

***

## 5. Supplier Master Data

This data is stored in settings and is editable.

```text
Business Name   : Sri Vaishnav Constructions
Address Line 1  : 2-14, Godavarru, Kankipadu Mandal
Address Line 2  : Krishna District, Andhra Pradesh — 521 344
GSTIN           : 37ADUPU2453N1ZK
PAN             : ADUPU2453N
State           : Andhra Pradesh
State Code      : 37
Phone           : editable
Email           : editable
Authorized Sig. : Uppalapati Surekha
```

### Bank Account Master

```text
Bank Account 1 (HDFC)
  Account Name  : Sri Vaishnav Constructions
  Account No    : 50200113268022
  IFSC          : HDFC0008170
  Branch        : HDFC Bank, Kankipadu Branch

Bank Account 2 (Axis)
  Account Name  : Sri Vaishnav Constructions
  Account No    : 913020033848984
  IFSC          : UTIB0000069
  Branch        : Axis Bank, Vijayawada Branch
```

***

## 6. Invoice Rules

### 6.1 Invoice Numbering

Format:
```text
{PREFIX}/{FY}/{SEQUENCE}
Example: SVC/26-27/001
```

Rules:
- Prefix configurable, default `SVC`
- FY calculated from invoice date (April–March)
- Sequence is 3-digit, zero-padded
- Resets to 001 on April 1 each year
- Unique and non-repeating within the financial year

### 6.2 GST Logic

| Condition | Tax Mode | Tax Applied |
|---|---|---|
| Supplier state = Place of Supply state | Intrastate | CGST 9% + SGST 9% |
| Supplier state ≠ Place of Supply state | Interstate | IGST 18% |

Rules:
- Supplier is always Andhra Pradesh (state code 37)
- Tax mode auto-detected by Place of Supply
- User may manually override, but override should be logged

### 6.3 SAC Code
- Default SAC: **997319**
- Editable if required
- Old usage of 9954 is deprecated and should not be defaulted

### 6.4 TDS
- Default TDS rate: 2%
- Calculated on taxable value only, not on GST-inclusive amount
- Always shown in invoice summary when applicable

### 6.5 Mandatory Invoice Content

Each invoice must include:
- Supplier name, address, GSTIN
- Invoice number
- Invoice date
- Recipient name and address
- Recipient GSTIN when applicable
- Place of Supply with state code
- Description of service
- SAC code
- Taxable value
- GST rate and tax amount
- Total invoice value
- Reverse charge field
- Authorized signatory / declaration area

***

## 7. Brand Identity & Color System

### 7.1 Brand Colors

Sri Vaishnav Constructions uses the following three colors as its brand identity. These are derived from the business logo and must be used consistently across both the app UI and all PDF invoices.

| Role | Color Name | Hex Code | Usage |
|---|---|---|---|
| **Brand Primary** | Deep Brown | `#3B2A1F` | Headers, primary text, key UI anchors |
| **Brand Background** | Warm Cream | `#F5F1E8` | Page backgrounds, invoice base, surfaces |
| **Brand Accent** | Golden Amber | `#C8A96A` | Buttons, highlights, active states, accent lines |

These three colors represent the brand across every touchpoint — from the app navigation to the PDF invoice the client receives.

### 7.2 Full App Color Palette

The three brand colors are expanded into a complete system that covers all UI states, statuses, and data visualization needs. The palette is warm-toned throughout to maintain brand cohesion.

#### Surfaces & Backgrounds (Light Mode)
| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#F5F1E8` | Page background (brand cream) |
| `--color-surface` | `#FAF8F3` | Card surfaces |
| `--color-surface-2` | `#FFFFFF` | Elevated modals, dropdowns |
| `--color-surface-offset` | `#EDE9DE` | Sidebar, section dividers |
| `--color-border` | `#D9D3C5` | Input borders, dividers |

#### Text
| Token | Value | Usage |
|---|---|---|
| `--color-text` | `#2A1F15` | Primary text (dark brown) |
| `--color-text-muted` | `#7A6A58` | Secondary labels, hints |
| `--color-text-faint` | `#B8A99A` | Placeholders, disabled |
| `--color-text-inverse` | `#F5F1E8` | Text on dark brown backgrounds |

#### Interactive & Accent
| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#3B2A1F` | Nav active states, headings |
| `--color-accent` | `#C8A96A` | Buttons, CTAs, active indicators |
| `--color-accent-hover` | `#B8944D` | Button hover state |
| `--color-accent-highlight` | `#F0E6CC` | Selected row background, tag bg |

#### Semantic Status Colors (Warm-harmonised)
| Token | Value | Usage |
|---|---|---|
| `--color-success` | `#5A7A2E` | Paid, Active WO, Covered |
| `--color-success-highlight` | `#DDE8C8` | Success badge background |
| `--color-warning` | `#A05C1A` | Expiring, Rate override, Draft |
| `--color-warning-highlight` | `#F5E0C8` | Warning badge background |
| `--color-error` | `#8B2E2E` | Uncovered, Overdue, Error |
| `--color-error-highlight` | `#F0D0D0` | Error badge background |
| `--color-info` | `#2A5F8A` | Interstate indicator, Info notices |
| `--color-info-highlight` | `#C8DCF0` | Info badge background |

#### Dark Mode Surfaces
| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#1C1510` | Page background (deep brown) |
| `--color-surface` | `#241C15` | Card surfaces |
| `--color-surface-2` | `#2D231A` | Elevated elements |
| `--color-surface-offset` | `#1A1209` | Sidebar background |
| `--color-text` | `#F0EBE0` | Primary text |
| `--color-accent` | `#D4B87A` | Accent (brightened for dark bg) |

### 7.3 Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| **Display / Headings** | Playfair Display | 600–700 | `--text-xl` and above |
| **Body / UI** | Work Sans | 400–600 | `--text-base` and below |
| **Numbers / Data** | Work Sans (tabular) | 500 | All numeric values |

- Playfair Display gives a professional, trustworthy feel appropriate for a construction billing app
- Work Sans is highly legible on mobile screens at small sizes
- All numeric data (invoice amounts, quantities, dates) must use `font-variant-numeric: tabular-nums` so columns align

***

## 8. PDF Invoice Design

### 8.1 Output Format
- PDF only
- A4 layout
- Professional, clean, print-friendly
- Consistent formatting across intrastate and interstate invoices
- Brand identity must be visible on every invoice

### 8.2 Layout Sections
1. Header with title `TAX INVOICE`
2. Supplier block (with logo / brand mark if available)
3. Invoice metadata block
4. Bill-to / recipient block
5. Place of supply and tax mode block
6. Work-order-linked project / billing reference block
7. Line items table
8. Totals block
9. Amount in words
10. Bank details
11. Declaration and signature area
12. Footer / terms

### 8.3 PDF Color Behavior (Updated — Brand-Aligned)

All invoices use the Sri Vaishnav Constructions brand palette. The intrastate/interstate distinction is achieved through a subtle accent color variation rather than an unrelated blue/green scheme.

| Invoice Type | Header Background | Header Text | Table Header | Accent Line | Base |
|---|---|---|---|---|---|
| **Intrastate** (CGST+SGST) | `#3B2A1F` (Deep Brown) | `#F5F1E8` (Cream) | `#C8A96A` (Gold) | Gold rule lines | Cream `#F5F1E8` |
| **Interstate** (IGST) | `#3B2A1F` (Deep Brown) | `#F5F1E8` (Cream) | `#2A5F8A` (Info Blue) | Blue-tinted rule lines | Cream `#F5F1E8` |

Both invoice types share the same brand header (deep brown + cream). Only the table headers and accent rule lines differ — gold for intrastate, blue-tinted for interstate — providing clear visual differentiation while keeping brand identity intact.

### 8.4 File Naming
```text
{PREFIX}_{FY}_{SeqNo}_{ClientShortName}_{YYYYMM}.pdf
Example: SVC_26-27_001_RSV_202604.pdf
```

***

## 9. Edit-and-Replace PDF Behavior

### 9.1 User Requirement
The app must allow backend edits if the user later discovers a mistake.

### 9.2 Required Behavior

When an invoice is edited:
- Existing invoice record is updated in Supabase
- PDF is regenerated in-browser
- Newly generated PDF replaces the previously stored PDF in Supabase Storage
- Invoice number remains unchanged
- `created_at` remains unchanged
- `last_modified_at` is updated
- `modification_reason` field may be captured optionally

### 9.3 Warnings

If the edited change affects rate, quantity, taxable value, GST amount, place of supply, or recipient GSTIN, the app should show:

> "This change affects invoice value or tax data. If the invoice has already been shared with the client, consider issuing a credit/debit note or formally revised document."

### 9.4 Statuses

| Status | Meaning | Editable? |
|---|---|---|
| Draft | Not yet finalized | Yes, fully |
| Final | Generated and stored | Yes, with warning and log |
| Cancelled | Withdrawn from active use | No direct billing use |
| Superseded | Major revision occurred | View-only |

***

## 10. Work Order Module

### 10.1 Purpose
Work orders are the operational foundation for billing. Bills should be related to valid work orders whenever available. Uploaded work orders should be scanned and structured so that invoice creation becomes easier, more accurate, and traceable.

### 10.2 Upload Flow

User uploads a **clean PDF work order**. The system performs:
1. OCR / text extraction (via Tesseract.js, runs in-browser)
2. AI-assisted structured parsing
3. Draft field extraction preview
4. User review and correction
5. Save to Supabase database
6. Store original PDF in Supabase Storage

### 10.3 Data to Extract from Work Order

The parser should attempt to extract:
- Work order date
- Work order number/reference (if present)
- Client name and address
- Subject / project description
- Contract duration text
- Validity start and end dates
- Work items table (unit, contracted quantity, rate, line amount)
- Total value
- Notes (rates firm, quantities approximate, monthly RA bills, TDS, GST status)

### 10.4 Based on Sample Work Orders

From the supplied samples:
- Both work orders are issued by **RSV Constructions Pvt. Ltd.**
- Both are dated **30/03/2026**
- Both specify a **15-month completion window**
- Both explicitly permit billing through **monthly Running Account Bills**
- Both state that **rates are firm and no escalation is allowed**
- Both state quantities are approximate and actual measurement controls payment

These observations directly shape the work-order logic.

### 10.5 Work Order Validity Logic

The app should compute:
- `valid_from = issue_date`
- `valid_to = issue_date + duration_months`

When raising an invoice for a billing period:
- If the billing period falls inside a valid work order range, show that work order as available
- If not, show a warning but do not block billing

### 10.6 Work Order States

| Status | Meaning |
|---|---|
| Active | Within validity and available for billing |
| Expiring Soon | Less than configured threshold (e.g. 30 days) remaining |
| Expired | Validity ended |
| Exhausted | All practical quantities billed / manually closed |
| Closed | No further billing intended |

***

## 11. Work Order Items and Billing Linkage

### 11.1 User Flow During Billing

While creating a bill:
1. User selects client
2. System shows work orders valid for the billing period
3. User chooses a work order (optional but recommended)
4. System shows available work-order items
5. User selects one or more items to include in this bill
6. System pre-fills descriptions, units, and rates
7. User selects related vehicle numbers
8. User enters actual billed quantity for the period

### 11.2 Rate Behavior

Rate is pre-filled from the work order item. If the user changes the rate:
- The app allows it
- A warning is shown (work orders state rates are firm and no escalation is allowed)
- The override reason is logged

Suggested warning:
> "The work order states that rates are firm and no escalation is allowed. Please confirm why this billing rate differs from the work order rate."

### 11.3 Quantity Tracking

The app should:
- Track cumulative billed quantity against each work-order item
- Warn if cumulative billed quantity nears or exceeds contracted quantity
- Allow billing even if exceeded, with a visible warning tag on the invoice

### 11.4 Work Order Coverage Warning

If no valid work order exists for the chosen billing period:
- Show a warning banner
- Do not block the user
- Tag the invoice with `work_order_coverage = missing`

***

## 12. AI Description Assistant

### 12.1 Purpose

Invoice descriptions are currently manually typed and inconsistent. The V3 app uses AI to create cleaner, more professional, GST-friendly descriptions.

### 12.2 AI Use Cases

#### Mode A — Auto Generate from Structured Data
Using selected work order, work-order item, vehicles, billing month, and project details, the system generates a polished description automatically.

Example pattern:
```text
Charges for transportation / rental service in connection with
{work item description} at {project or work order subject}
for the period {start date} to {end date}.
Vehicle No(s): {vehicle list}
```

#### Mode B — Improve Rough User Input
User types weak text such as:
```text
april earthwork both vehicles nidadavolu site
```
AI rewrites it into clear billing language.

#### Mode C — Suggest Better Language
User writes a description and clicks: Improve / Simplify / Make more professional / Make shorter / Make clearer. The AI suggests edits.

### 12.3 AI Guardrails
The AI must use only: work-order data, selected vehicles, selected dates, selected items, and user notes. It must not invent facts.

### 12.4 Description Validation
Before finalising an invoice, validate whether description includes: work type, project / work-order reference, billing period or month, and vehicle number(s) where applicable. If too vague, warn the user.

***

## 13. Vehicle Selection and Usage

### 13.1 Vehicle Master

Each vehicle record should include:
- Registration number
- Vehicle type
- Capacity
- Unit basis if needed
- Default rate (optional internal use)
- Active / inactive
- Notes

### 13.2 During Billing

The user can select one or more vehicle numbers per bill. Selected vehicles are used in description generation, invoice line linkage, dashboard analytics, and vehicle utilization reporting.

### 13.3 Vehicle-Linked Billing Intelligence

The app should support:
- Invoice search by vehicle number
- Monthly billing history by vehicle
- Idle vehicle alerts
- Vehicle work-order association analytics

***

## 14. Dashboard Design

### 14.1 Purpose

The dashboard delivers immediate operational and financial visibility. It is the **primary desktop view** — optimised for wide screens with multiple panels visible simultaneously.

### 14.2 Top-Level Goals

The dashboard should answer:
- How much has been billed this month and this FY?
- Which work orders are active, expiring, or uncovered?
- Which vehicles are active or idle?
- Are there draft invoices, rate overrides, or coverage warnings?
- What trends are visible over time?

### 14.3 Dashboard Sections

#### A. KPI Cards
- Total Billed This Month
- Total Billed This FY
- Active Work Orders
- Expiring Work Orders
- Draft Invoices
- Invoices Without Work Order Coverage
- Vehicles Used This Month
- Rate Override Events

KPI cards use the brand accent gold (`#C8A96A`) for positive values and semantic warning/error colors for alerts.

#### B. Monthly Revenue Graph
- Month-wise billing totals for current FY
- Bar or line chart in brand colors
- Breakdown by taxable value, GST, and net payable

#### C. Work Order Utilization
Per work order and per work-order item:
- Contracted quantity
- Billed quantity till date
- Balance quantity
- Percent used (progress bar in gold)
- Expiry date

#### D. Vehicle Usage Graphs
- Invoices per vehicle by month
- Billed quantity per vehicle
- Revenue contribution by vehicle
- Active vs idle vehicles

#### E. Flags and Alerts Panel

| Flag Type | Color |
|---|---|
| No valid work order | `--color-error` |
| Work order expiring within 30 days | `--color-error` |
| Work order expiring within 90 days | `--color-warning` |
| Quantity usage above threshold | `--color-warning` |
| Rate override used | `--color-warning` |
| Draft invoice pending too long | `--color-warning` |
| No invoice raised this month | `--color-info` |
| Vehicle idle for current month | `--color-info` |

#### F. Recent Invoices Table
- Invoice number, client, billing month, value, tax mode, work order linked or not, status

### 14.4 Additional Dashboard Features

#### Financial Year Summary Toggle
Toggle between Current FY / Previous FY / Custom FY for trend comparison.

#### Billing Calendar View
Calendar-style view showing: months billed, draft months, missing billing periods, key due periods.

#### Work Order Coverage Indicator
- 🟢 Green: covered by at least one active work order
- 🟡 Amber: partially covered
- 🔴 Red: no valid work order found

***

## 15. Mobile-First UI Design

### 15.1 Design Principles

The app is designed **mobile-first**. The mobile experience (iPhone) is the primary daily-use interface. Desktop is the secondary overview interface. Every screen must be fully usable on a 390px-wide screen before being expanded for desktop.

Key mobile design rules:
- All tap targets minimum 44×44px
- Step-by-step invoice creation wizard (one task per screen)
- Bottom navigation bar for primary sections
- Large, readable typography — minimum 16px body text
- No hover-only UI interactions
- Active/tap states on every interactive element for immediate feedback
- Forms broken into small steps — never a long scrolling form

### 15.2 Navigation Structure

**Mobile (< 768px) — Bottom Tab Bar:**
- 🏠 Dashboard
- ➕ New Bill
- 📄 Invoices
- 📋 Work Orders
- ⚙️ More (Settings, Clients, Vehicles, Projects)

**Desktop (≥ 1024px) — Sidebar Navigation:**
- Full sidebar with section labels
- Collapsible to icon-only at medium widths (768–1024px)
- All 10 modules accessible directly

### 15.3 Invoice Creation on Mobile

The invoice creation flow is a **multi-step wizard** optimised for thumb-friendly use:

| Step | Screen Title | Mobile Layout |
|---|---|---|
| 1 | Header Details | Large date picker, client dropdown, period selector |
| 2 | Work Order | Card-based WO selection with coverage badge |
| 3 | Work Items | Checkbox list with rate and qty visible |
| 4 | Vehicles | Multi-select chip list of active vehicle numbers |
| 5 | Description | Text area + AI assist button |
| 6 | Values | Quantity + rate fields, auto-computed totals |
| 7 | Preview | Full invoice preview, scrollable |
| 8 | Generate | Single large "Generate & Save PDF" button |

### 15.4 Dashboard on Mobile

On mobile, the dashboard collapses to a single-column scroll:
- KPI cards stack vertically (2 per row)
- Charts go full-width
- Tables become card lists with swipe-to-action
- Billing calendar becomes a compact month strip

***

## 16. Invoice Creation Flow (Full Detail)

### Step 1 — Header
Fields: Invoice date, invoice number (auto-generated), client, recipient GSTIN, place of supply, tax mode, reverse charge, billing month / billing period.

### Step 2 — Work Order Link
Fields: Select valid work order for this billing period, view work order subject / summary, coverage indicator, warning if no valid work order.

### Step 3 — Select Work Items
Fields: Multi-select work-order items, show rate / unit / contracted qty / billed-to-date qty, show warning on near-limit / over-limit usage.

### Step 4 — Select Vehicles
Fields: Multi-select active vehicles, vehicle tags shown in summary.

### Step 5 — Description Builder
Capabilities: Auto-build from selected data, user rough text input, AI improve / simplify / shorten / formalize, final editable text box.

### Step 6 — Quantities and Values
Fields: Quantity, rate, discount (optional), taxable value, GST computation, TDS, advance adjustment if needed.

### Step 7 — Preview
Preview shows final invoice PDF-like layout before generation.

### Step 8 — Generate PDF
Actions: Save invoice record to Supabase, generate PDF in-browser, upload PDF to Supabase Storage, store PDF URL, update status to final.

***

## 17. Invoice History

### 17.1 List Columns
Invoice No, Date, Client, Billing Period, Work Order Ref, Tax Mode, Total Amount, Net Payable, Status, Last Modified At.

### 17.2 Filters
Financial year, client, work order, vehicle number, billing month, date range, status, coverage missing yes/no, rate override yes/no.

### 17.3 Actions
View PDF, Edit, Duplicate, Cancel, Download PDF, Share via WhatsApp.

***

## 18. Clients Module

Each client record stores:
- Name
- Address(es)
- Multiple GSTINs mapped by state
- Contact details
- Active / inactive status

The app should auto-link uploaded work orders to existing clients where possible based on extracted name and known GSTIN / state patterns.

***

## 19. Projects / Work References

Each project may store:
- Project name
- Full subject / reference text
- Client linkage
- State / place of supply
- Site aliases
- Work-order linkage
- Active / inactive status

This is especially useful because sample work orders reference complex railway and ROB/FOB projects.

***

## 20. Payment Tracking (Included in V3)

Suggested fields:
- Invoice total
- TDS deducted
- Expected net receivable
- Amount received
- Received date
- Payment status: unpaid / partial / paid
- TDS certificate received yes/no
- Notes

Dashboard benefits: outstanding amount visibility, payment aging, pending TDS tracking.

***

## 21. Database Design (Supabase / PostgreSQL)

All tables are hosted on Supabase (PostgreSQL). The schema is identical in structure to the V2 SQLite design, ported to PostgreSQL syntax with row-level security (RLS) enabled on all tables.

### 21.1 settings
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 21.2 clients
```sql
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  gstin_ap TEXT,
  gstin_other TEXT,
  gstin_other_state TEXT,
  gstin_other_code TEXT,
  phone TEXT,
  email TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 21.3 vehicles
```sql
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  reg_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT,
  capacity NUMERIC,
  unit TEXT DEFAULT 'CUM',
  default_rate NUMERIC,
  active BOOLEAN DEFAULT TRUE,
  notes TEXT
);
```

### 21.4 projects
```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  full_name TEXT,
  client_id INTEGER REFERENCES clients(id),
  state TEXT,
  state_code TEXT,
  place_of_supply TEXT,
  active BOOLEAN DEFAULT TRUE
);
```

### 21.5 work_orders
```sql
CREATE TABLE work_orders (
  id SERIAL PRIMARY KEY,
  wo_number TEXT,
  client_id INTEGER REFERENCES clients(id),
  project_id INTEGER REFERENCES projects(id),
  subject TEXT NOT NULL,
  issue_date DATE NOT NULL,
  duration_months INTEGER,
  valid_from DATE,
  valid_to DATE,
  total_value NUMERIC,
  original_pdf_url TEXT,
  extracted_text TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 21.6 work_order_items
```sql
CREATE TABLE work_order_items (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  sl_no INTEGER,
  description TEXT NOT NULL,
  unit TEXT,
  contracted_qty NUMERIC,
  rate NUMERIC NOT NULL,
  amount NUMERIC,
  cumulative_billed_qty NUMERIC DEFAULT 0,
  sub_work_ref TEXT
);
```

### 21.7 invoices
```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  financial_year TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  billing_period_from DATE,
  billing_period_to DATE,
  client_id INTEGER REFERENCES clients(id),
  client_name TEXT,
  client_address TEXT,
  client_gstin TEXT,
  place_of_supply TEXT,
  pos_state_code TEXT,
  tax_mode TEXT NOT NULL,
  reverse_charge TEXT DEFAULT 'No',
  project_id INTEGER REFERENCES projects(id),
  work_order_id INTEGER REFERENCES work_orders(id),
  work_order_coverage TEXT,
  project_desc TEXT,
  ai_description_used BOOLEAN DEFAULT FALSE,
  total_taxable NUMERIC,
  total_cgst NUMERIC DEFAULT 0,
  total_sgst NUMERIC DEFAULT 0,
  total_igst NUMERIC DEFAULT 0,
  total_tax NUMERIC,
  total_invoice_amount NUMERIC,
  tds_amount NUMERIC,
  advance_amount NUMERIC DEFAULT 0,
  net_payable NUMERIC,
  amount_in_words TEXT,
  pdf_storage_url TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ,
  modification_reason TEXT,
  payment_status TEXT DEFAULT 'unpaid',
  amount_received NUMERIC DEFAULT 0,
  received_date DATE,
  tds_certificate_received BOOLEAN DEFAULT FALSE,
  notes TEXT
);
```

### 21.8 invoice_line_items
```sql
CREATE TABLE invoice_line_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  sl_no INTEGER NOT NULL,
  work_order_item_id INTEGER REFERENCES work_order_items(id),
  description TEXT NOT NULL,
  vehicle_summary TEXT,
  sac_code TEXT DEFAULT '997319',
  unit TEXT DEFAULT 'CUM',
  qty NUMERIC,
  rate NUMERIC,
  discount NUMERIC DEFAULT 0,
  taxable_value NUMERIC,
  cgst_rate NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_rate NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  igst_rate NUMERIC DEFAULT 0,
  igst_amount NUMERIC DEFAULT 0,
  line_total NUMERIC,
  rate_overridden BOOLEAN DEFAULT FALSE,
  override_reason TEXT
);
```

### 21.9 invoice_vehicles
```sql
CREATE TABLE invoice_vehicles (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id)
);
```

***

## 22. Application Screens

### 22.1 Dashboard
Operational graphs, KPIs, flags, calendar, utilization, FY toggle. Full-width on desktop. Stacked cards on mobile.

### 22.2 New Bill
Multi-step wizard (8 steps). Optimised for mobile one-step-per-screen flow.

### 22.3 Invoice History
Browse, filter, edit, duplicate, review. Card list on mobile, sortable table on desktop.

### 22.4 Work Orders
Upload, review extraction, manage statuses, monitor utilization.

### 22.5 Clients
Client master management.

### 22.6 Vehicles
Vehicle master management.

### 22.7 Projects
Optional structured project references.

### 22.8 Settings
Business details, invoice numbering, GST/TDS defaults, PDF styling, brand colors.

***

## 23. Recommended Technical Stack (V3 — PWA + Cloud)

### 23.1 Architecture Overview

V3 is a **Progressive Web App (PWA)** — a website that installs on the iPhone home screen like a native app, with no App Store required and no Apple Developer fees.

```
┌─────────────────────────────────────────────────┐
│              Sri Vaishnav Constructions          │
│                                                  │
│  Dad's iPhone ──┐                               │
│                 ├──► Supabase (Cloud DB + Files) │
│  Desktop    ────┤         PostgreSQL             │
│                 │         PDF Storage            │
│  Your Phone ───┘                                │
└─────────────────────────────────────────────────┘
```

### 23.2 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React (via Vite) | UI components, routing, state |
| **PWA Shell** | Vite PWA Plugin + Workbox | Installable on iPhone, offline support |
| **UI Styling** | Tailwind CSS | Responsive, mobile-first styling with brand tokens |
| **Database** | Supabase (PostgreSQL) | Cloud database — syncs all devices in real time |
| **Offline Cache** | IndexedDB via Dexie.js | Local cache when internet is unavailable |
| **File Storage** | Supabase Storage | Stores generated PDF invoices and uploaded work orders |
| **Authentication** | Supabase Auth | Secure login — only family/authorised users access the app |
| **PDF Generation** | jsPDF + html2canvas | Generates branded PDF invoices directly in the browser |
| **OCR (Work Orders)** | Tesseract.js | Extracts text from uploaded work order PDFs, runs in-browser |
| **AI Assistant** | OpenAI / Gemini API | Invoice description generation and improvement |
| **Hosting** | Vercel | Free hosting, auto-deploys from GitHub |

### 23.2A Backend Note

Supabase serves as the backend platform for database, authentication, storage, APIs, realtime sync, and server-side functions. Therefore, the application is not frontend-only even though the user interface is delivered as a PWA.

### 23.3 Why PWA + Supabase

| Requirement | How It Is Met |
|---|---|
| Works on iPhone without App Store | PWA installed via Safari "Add to Home Screen" |
| No Apple Developer fee (₹8,000+/year) | PWA requires no App Store submission |
| Works on desktop too | Same codebase, responsive layout |
| Data syncs across all devices | All data lives in Supabase cloud DB |
| Works offline (no internet) | IndexedDB caches recent data; syncs on reconnect |
| PDF generation | jsPDF runs entirely in-browser |
| Zero hosting cost | Vercel free tier + Supabase free tier |
| Easy updates | Push to GitHub → Vercel auto-deploys in ~30 seconds |

### 23.4 Hosting Cost Summary

| Service | Cost |
|---|---|
| Vercel (frontend hosting) | **Free** |
| Supabase (database + storage) | **Free** (500 MB DB, 1 GB storage — more than sufficient) |
| Domain name (optional) | ₹700–900/year (optional custom domain) |
| **Total** | **₹0/month** (or ~₹75/month with custom domain) |

### 23.5 Offline Behavior

The app handles poor/no internet connectivity gracefully:
- Recently viewed invoices, clients, vehicles, and work orders are cached in IndexedDB
- New invoices can be **drafted offline** and queued for sync
- When internet reconnects, all queued changes sync to Supabase automatically
- A small connectivity indicator is shown in the UI (green = online, amber = syncing, grey = offline)

### 23.6 Data Backup

Since data lives in Supabase (not just one device), it is inherently backed up. Additionally:
- The app provides a **"Export Backup"** feature that downloads all invoices, work orders, and master data as a ZIP file (JSON + PDFs)
- This is accessible from Settings → Backup & Export

***

## 24. Backend Architecture and Server-Side Responsibilities

Although the user interface is delivered as a React-based Progressive Web App, the system is **not frontend-only**. Shared business data, authentication, secure file storage, and multi-device consistency require backend services. These backend capabilities are provided through **Supabase**, which acts as the application backend platform.

### 24.1 Backend Platform

The backend layer consists of:
- **Supabase PostgreSQL** for structured business data
- **Supabase Auth** for secure login and access control
- **Supabase Storage** for generated PDFs and uploaded work orders
- **Supabase Realtime / API layer** for cross-device data sync
- **Supabase Edge Functions** for secure server-side business logic

### 24.2 Responsibilities of the Frontend

The frontend PWA is responsible for:
- Rendering screens and forms
- Mobile billing wizard flow
- Invoice preview generation in the UI
- Dashboard and charts rendering
- Temporary offline drafts and local cache using IndexedDB

### 24.3 Responsibilities of the Backend

The backend is responsible for:
- Generating **final invoice numbers** centrally to avoid duplicates across devices
- Saving invoice header, line items, vehicle links, and totals in a controlled transaction
- Enforcing access control and data permissions
- Storing and retrieving PDF invoices and work order files securely
- Executing AI requests without exposing API keys in the browser
- Recording audit logs for edits, overrides, and important actions
- Supporting consistent multi-device sync between phone and desktop

### 24.4 Why Server-Side Logic Is Necessary

Some logic must not be left entirely to the frontend. For example, if two devices generate invoice numbers locally at the same time, duplicate invoice numbers may occur. Similarly, AI API keys and protected storage operations should not be exposed in browser code. Therefore, critical business actions must be executed through server-side functions.

### 24.5 Design Principle

The architecture follows a **thin frontend + managed backend** model:
- The frontend handles user experience and local responsiveness
- The backend handles data integrity, security, and shared business rules

This approach keeps the system simple to maintain while still providing proper backend reliability.

***

## 25. Operational Rules and Warnings

### 24.1 No-Restriction Philosophy with Strong Warnings

The app should warn more than it blocks. Warnings are used for:
- No valid work order
- Expired work order
- Rate override
- Quantity exceeding expected contract quantity
- Vague description
- Future invoice date
- Different FY date
- Client GSTIN mismatch with Place of Supply

### 24.2 User Flexibility

The user should still be able to:
- Bill without a work order
- Edit a final invoice
- Override a rate
- Exceed work-order quantity
- Manually rewrite any description

Every such action is visible in the audit log and flagged on the dashboard.

***

## 26. Dashboard Graph Ideas (Detailed)

Recommended charts for V3 (all using brand color palette):
- Monthly billed value trend (bar chart, gold bars on cream)
- Taxable vs GST vs net payable trend (stacked bar)
- Vehicle-wise invoice count (horizontal bar)
- Vehicle-wise billed amount contribution (donut)
- Work-order-wise billed quantity utilization (progress bars in gold)
- Work-order expiry timeline (Gantt-style)
- Status donut: draft / final / cancelled
- Coverage donut: with WO / without WO
- Rate override count by month
- Payment status summary (paid / partial / unpaid)

***

## 27. Suggested Future Enhancements

- WhatsApp share of generated PDF directly from the app
- Email invoice as attachment from the app
- Credit note / debit note module
- Payment reminder tracking
- TDS certificate reconciliation
- OCR confidence scoring for work-order extraction
- Role-based access if business grows (admin vs view-only)
- Audit log screen
- Search by project keywords inside work-order text
- Multi-language support (Telugu UI option)

***

## 28. Implementation Priorities (V3 Phased Plan)

### Phase 1 — Core MVP
- PWA setup (React + Vite + Workbox)
- Supabase project setup (DB + Storage + Auth)
- Vercel deployment pipeline
- Settings, Clients, Vehicles
- Invoice numbering
- PDF invoice generation (branded, both intrastate and interstate layouts)
- Invoice history
- Edit-and-replace PDF

### Phase 2 — Work Order Intelligence
- Work order upload to Supabase Storage
- OCR extraction via Tesseract.js
- Work-order-linked billing
- Quantity / rate warnings
- Coverage indicator

### Phase 3 — AI Assistance
- AI description generation (Mode A — auto from structured data)
- Mode B — improve rough user input
- Mode C — rewrite suggestions

### Phase 4 — Dashboard and Insights
- KPI cards
- Monthly revenue chart
- Work order utilization graphs
- Vehicle analytics
- FY toggle
- Billing calendar
- Flags center

### Phase 5 — Advanced Controls
- Payment tracking
- Credit / debit note support
- WhatsApp sharing workflow
- Audit reporting
- Offline sync robustness

***

## 29. Final Product Summary

V3 is a **mobile-first, PWA-powered, GST billing and work-order management system** for Sri Vaishnav Constructions. It is designed to be used daily from an iPhone — creating invoices, linking work orders, selecting vehicles, and generating branded PDFs — while offering a full operational dashboard on desktop for monthly progress reviews.

The app syncs data in real time across all devices via Supabase, works offline with IndexedDB caching, and is hosted for free on Vercel. It carries a clear brand identity through its color system — deep brown (`#3B2A1F`), warm cream (`#F5F1E8`), and golden amber (`#C8A96A`) — applied consistently across both the app UI and every PDF invoice that goes to the client.

The strongest product value comes from connecting all operational pieces together: valid work orders, selected items, selected vehicles, cleaner AI-assisted descriptions, billing-period coverage warnings, and dashboard visibility. That will make billing faster, more accurate, and far more organized than the current manual monthly process.

***

*Document Version: V3 | Last Updated: May 2026 | Prepared for: Sri Vaishnav Constructions*