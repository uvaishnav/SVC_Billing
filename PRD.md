# GST Invoice & Work Order Billing App — Product Requirement Documentation V2

## 1. Overview

This document defines the complete V2 specification for a billing application for **Sri Vaishnav Constructions**. The app is designed to generate **GST-compliant PDF tax invoices** for equipment and transport-related billing, manage work orders, assist with AI-powered description writing, support invoice editing with controlled PDF replacement, and provide an operational dashboard for vehicles, work orders, billing, and compliance monitoring. The original V1 concept focused on Excel generation, but the revised V2 direction uses **PDF as the primary and only invoice output format**, because GST law requires correct invoice contents rather than Excel specifically.[web:2][web:12]

The system is intended for a small construction and rental business that currently raises monthly running bills for RSV Constructions and similar clients. The app must reduce manual work, avoid GST mistakes, organize work-order-linked billing, and improve internal control over rates, vehicles, billing periods, and invoice history.

---

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

### 2.3 V2 Goal
The V2 app must:
- Generate **professional PDF invoices only**
- Remain GST-compliant
- Link bills to uploaded work orders
- Extract structured work-order data from clean PDFs
- Pre-fill billable items and rates from valid work orders
- Warn on rate overrides and billing outside work-order validity
- Let the user edit invoices internally and regenerate the same invoice PDF in place
- Use AI to help create, improve, and simplify invoice descriptions
- Track vehicles, work orders, invoices, flags, and billing patterns on a dashboard

---

## 3. Compliance Position

### 3.1 PDF-Only Invoices Are Acceptable
GST compliance in India is based on **mandatory invoice contents**, not on Excel as a required format. A valid tax invoice may be generated as PDF so long as all required fields under GST invoice rules are present, such as supplier details, recipient details, invoice number, date, description, taxable value, tax details, and place of supply.[web:2][web:12]

Therefore, this app will generate **PDF invoices only**.

### 3.2 Editing Issued Invoices
The app may allow internal edits and regeneration of a PDF invoice. However, the internal system should distinguish between:
- **Draft invoices** — fully editable
- **Final invoices** — editable with warning and internal audit logging
- **Tax-impacting changes after issue** — should trigger warning recommending credit/debit note handling rather than silent correction, especially if values materially change

This app is designed as an internal operational tool for a small business below the typical e-invoicing threshold discussed earlier; however, invoice history and modification timestamps should still be preserved for internal control.[web:33][web:39]

---

## 4. Core Product Direction

### 4.1 Primary Output
- **Single output:** PDF tax invoice
- No Excel generation in V2
- Printable and shareable by WhatsApp / email outside the app workflow in future scope

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

---

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

---

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
| Supplier state != Place of Supply state | Interstate | IGST 18% |

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

---

## 7. PDF Invoice Design

### 7.1 Output Format
- PDF only
- A4 layout
- Professional, clean, print-friendly
- Consistent formatting across intrastate and interstate invoices

### 7.2 Layout Sections
1. Header with title `TAX INVOICE`
2. Supplier block
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

### 7.3 Color Behavior
Recommended theme behavior:
- Blue-accent layout for intrastate bills
- Green-accent layout for interstate bills
- Neutral professional base with strong print readability

### 7.4 File Naming
```text
{PREFIX}_{FY}_{SeqNo}_{ClientShortName}_{YYYYMM}.pdf
Example: SVC_26-27_001_RSV_202604.pdf
```

---

## 8. Edit-and-Replace PDF Behavior

### 8.1 User Requirement
The app must allow backend edits if the user later discovers a mistake.

### 8.2 Required Behavior
When an invoice is edited:
- Existing invoice record is updated
- PDF is regenerated
- Newly generated PDF replaces the previously stored PDF for that same invoice
- Invoice number remains unchanged
- `created_at` remains unchanged
- `last_modified_at` is updated
- `modified_by_reason` field may be captured optionally

### 8.3 Warnings
If the edited change affects:
- rate
- quantity
- taxable value
- GST amount
- place of supply
- recipient GSTIN

Then the app should show a warning such as:
> “This change affects invoice value or tax data. If the invoice has already been shared with the client, consider issuing a credit/debit note or formally revised document.”

### 8.4 Statuses
| Status | Meaning | Editable? |
|---|---|---|
| Draft | Not yet finalized | Yes, fully |
| Final | Generated and stored | Yes, with warning and log |
| Cancelled | Withdrawn from active use | No direct billing use |
| Superseded | Optional advanced status when major revision occurs | View-only |

---

## 9. Work Order Module

### 9.1 Purpose
Work orders are the operational foundation for billing. Bills should be related to valid work orders whenever available. Uploaded work orders should be scanned and structured so that invoice creation becomes easier, more accurate, and traceable.

### 9.2 Upload Flow
User uploads a **clean PDF work order**.

The system performs:
1. OCR / text extraction
2. AI-assisted structured parsing
3. Draft field extraction preview
4. User review and correction
5. Save to database
6. Store original PDF path for reference

### 9.3 Data to Extract from Work Order
The parser should attempt to extract:
- Work order date
- Work order number/reference (if present)
- Client name
- Client address
- Subject / project description
- Contract duration text
- Validity start date
- Validity end date (computed from duration where possible)
- Work items table
- Unit
- Contracted quantity
- Rate
- Line amount
- Total value
- Notes like:
  - rates are firm
  - quantities are approximate
  - monthly RA bills allowed
  - TDS deductible
  - GST excluded or included language

### 9.4 Based on Sample Work Orders
From the supplied samples:
- Both work orders are issued by **RSV Constructions Pvt. Ltd.** [file:46][file:47]
- Both are dated **30/03/2026** [file:46][file:47]
- Both specify a **15-month completion window** [file:46][file:47]
- Both explicitly permit billing through **monthly Running Account Bills** [file:46][file:47]
- Both state that **rates are firm and no escalation is allowed** [file:46][file:47]
- Both state quantities are approximate and actual measurement controls payment [file:46][file:47]

These observations should directly shape the work-order logic.

### 9.5 Work Order Validity Logic
The app should compute:
- `valid_from = issue_date`
- `valid_to = issue_date + duration_months`

When raising an invoice for a billing period:
- If the billing period falls inside a valid work order range, show that work order as available
- If not, show warning but do not block billing

### 9.6 Work Order States
| Status | Meaning |
|---|---|
| Active | Within validity and available for billing |
| Expiring Soon | Less than configured threshold left |
| Expired | Validity ended |
| Exhausted | All practical quantities billed / manually closed |
| Closed | No further billing intended |

---

## 10. Work Order Items and Billing Linkage

### 10.1 User Flow During Billing
While creating a bill:
1. User selects client
2. System shows work orders valid for the billing period
3. User chooses a work order (optional but recommended)
4. System shows available work-order items
5. User selects one or more items to include in this bill
6. System pre-fills descriptions, units, and rates
7. User selects related vehicle numbers
8. User enters actual billed quantity for the period

### 10.2 Rate Behavior
Rate should be pre-filled from the work order item.

If the user changes the rate:
- The app must allow it
- The app must show a warning because sample work orders explicitly say rates are firm and no escalation is allowed [file:46][file:47]
- The app should log the override reason

Suggested warning:
> “The work order states that rates are firm and no escalation is allowed. Please confirm why this billing rate differs from the work order rate.”

### 10.3 Quantity Tracking
Because sample work orders say quantities are approximate and payment is based on actual measured work [file:46][file:47], the app should:
- Track cumulative billed quantity against each work-order item
- Warn if cumulative billed quantity nears or exceeds contracted quantity
- Allow billing even if exceeded, because actual site billing may still proceed subject to approval

### 10.4 Work Order Coverage Warning
If no valid work order exists for the chosen billing period:
- show a warning banner
- do not block the user
- tag the invoice with `work_order_coverage = missing`

This enables operational flexibility while preserving visibility.

---

## 11. AI Description Assistant

### 11.1 Purpose
Invoice descriptions are currently manually typed and inconsistent. The V2 app should use AI to create cleaner, more professional, GST-friendly descriptions using simple language.

### 11.2 AI Use Cases
The AI assistant should support three modes:

#### Mode A — Auto Generate from Structured Data
Using:
- selected work order
- selected work-order item
- selected vehicles
- billing month
- work dates
- project / site details

The system generates a polished description automatically.

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
User writes a description and clicks:
- Improve
- Simplify
- Make more professional
- Make shorter
- Make clearer

The AI then suggests edits.

### 11.3 AI Guardrails
The AI should not invent facts. It must use only:
- work-order data
- selected vehicles
- selected dates
- selected items
- user notes

### 11.4 Description Validation
Before finalizing invoice, validate whether description includes:
- work type
- project or work-order reference
- billing period or month
- vehicle number(s) where applicable

If too vague, warn the user.

---

## 12. Vehicle Selection and Usage

### 12.1 Vehicle Master
Each vehicle record should include:
- Registration number
- Vehicle type
- Capacity
- Unit basis if needed
- Default rate (optional internal use)
- Active / inactive
- Notes

### 12.2 During Billing
The user should be able to select one or more vehicle numbers related to a bill.

These selected vehicles should be used in:
- description generation
- invoice line linkage
- dashboard analytics
- vehicle utilization reporting

### 12.3 Vehicle-Linked Billing Intelligence
The app should later support:
- invoice search by vehicle number
- monthly billing history by vehicle
- idle vehicle alerts
- vehicle work-order association analytics

---

## 13. Dashboard Design

### 13.1 Purpose
The dashboard should give immediate operational and financial visibility into the business.

### 13.2 Top-Level Goals
The dashboard should answer:
- How much has been billed this month and this FY?
- Which work orders are active, expiring, or uncovered?
- Which vehicles are active or idle?
- Are there draft invoices, rate overrides, or coverage warnings?
- What trends are visible over time?

### 13.3 Dashboard Sections

#### A. KPI Cards
Recommended cards:
- Total Billed This Month
- Total Billed This FY
- Active Work Orders
- Expiring Work Orders
- Draft Invoices
- Invoices Without Work Order Coverage
- Vehicles Used This Month
- Rate Override Events

#### B. Monthly Revenue Graph
- Month-wise billing totals for current FY
- Bar or line chart
- Breakdown by taxable value, GST, and net payable where useful

#### C. Work Order Utilization
Per work order and per work-order item:
- contracted quantity
- billed quantity till date
- balance quantity
- percent used
- expiry date

#### D. Vehicle Usage Graphs
Recommended vehicle analytics:
- invoices per vehicle by month
- billed quantity per vehicle
- revenue contribution by vehicle
- active vs idle vehicles

#### E. Flags and Alerts Panel
Potential flags:
- No valid work order for selected period
- Work order expiring within 90 days
- Work order expiring within 30 days
- Quantity usage above threshold
- Rate override used
- Draft invoice pending too long
- No invoice raised this month
- Vehicle idle for current month

#### F. Recent Invoices Table
Show latest invoices with:
- invoice number
- client
- billing month
- value
- tax mode
- work order linked or not
- status

### 13.4 Additional Dashboard Features Requested
The following user-approved items must be included:

#### Financial Year Summary Toggle
A toggle to switch dashboard analytics between:
- Current FY
- Previous FY
- Custom FY

This helps compare trends over multiple years.

#### Billing Calendar View
A calendar-style view that shows:
- months billed
- draft months
- missing billing periods
- key due periods / invoice activity

This helps quickly identify gaps in monthly billing.

#### Work Order Coverage Indicator
A dedicated indicator that shows whether the current billing period is covered by at least one active work order.

Possible states:
- Green: covered
- Amber: partially covered
- Red: no valid work order found

---

## 14. Invoice Creation Flow (Updated V2)

### Step 1 — Header
Fields:
- Invoice date
- Invoice number (auto-generated)
- Client
- Recipient GSTIN
- Place of Supply
- Tax mode
- Reverse charge
- Billing month / billing period

### Step 2 — Work Order Link
Fields:
- Select valid work order for this billing period
- View work order subject / summary
- Coverage indicator
- Warning if no valid work order

### Step 3 — Select Work Items
Fields:
- Multi-select work-order items
- Show rate, unit, contracted qty, billed-to-date qty
- Show warning on near-limit / over-limit usage

### Step 4 — Select Vehicles
Fields:
- Multi-select active vehicles
- Vehicle tags shown in summary

### Step 5 — Description Builder
Capabilities:
- auto-build from selected data
- user rough text input
- AI improve / simplify / shorten / formalize
- final editable text box

### Step 6 — Quantities and Values
Fields:
- quantity
- rate
- discount (optional)
- taxable value
- GST computation
- TDS
- advance adjustment if needed

### Step 7 — Preview
Preview shows final invoice PDF-like layout before generation.

### Step 8 — Generate PDF
Actions:
- save invoice record
- generate PDF
- store PDF path
- update status to final

---

## 15. Invoice History

### 15.1 List Columns
- Invoice No
- Date
- Client
- Billing Period
- Work Order Ref
- Tax Mode
- Total Amount
- Net Payable
- Status
- Last Modified At

### 15.2 Filters
- Financial year
- Client
- Work order
- Vehicle number
- Billing month
- Date range
- Status
- Coverage missing yes/no
- Rate override yes/no

### 15.3 Actions
- View PDF
- Edit
- Duplicate
- Cancel
- Mark as draft/final where workflow allows

---

## 16. Clients Module

The app must support multiple clients.

Each client record should store:
- Name
- Address(es)
- Multiple GSTINs mapped by state
- Contact details
- Active / inactive status

The app should auto-link uploaded work orders to existing clients where possible based on extracted name and known GSTIN/state patterns.

---

## 17. Projects / Work References

Projects can be separately maintained to improve organization.

Each project may store:
- Project name
- Full subject / reference text
- Client linkage
- State / place of supply
- Site aliases
- Work-order linkage
- Active / inactive status

This is especially useful because sample work orders reference complex railway and ROB/FOB projects.[file:46][file:47]

---

## 18. Payment Tracking (Recommended in V2)

Although not the main original request, payment tracking significantly improves usefulness.

Suggested fields:
- Invoice total
- TDS deducted
- Expected net receivable
- Amount received
- Received date
- Payment status: unpaid / partial / paid
- TDS certificate received yes/no
- Notes

Dashboard benefits:
- outstanding amount visibility
- payment aging
- pending TDS tracking

---

## 19. Database Design

### 19.1 settings
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 19.2 clients
```sql
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  gstin_ap TEXT,
  gstin_other TEXT,
  gstin_other_state TEXT,
  gstin_other_code TEXT,
  phone TEXT,
  email TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 19.3 vehicles
```sql
CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reg_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT,
  capacity REAL,
  unit TEXT DEFAULT 'CUM',
  default_rate REAL,
  active INTEGER DEFAULT 1,
  notes TEXT
);
```

### 19.4 projects
```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  full_name TEXT,
  client_id INTEGER REFERENCES clients(id),
  state TEXT,
  state_code TEXT,
  place_of_supply TEXT,
  active INTEGER DEFAULT 1
);
```

### 19.5 work_orders
```sql
CREATE TABLE work_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wo_number TEXT,
  client_id INTEGER REFERENCES clients(id),
  project_id INTEGER REFERENCES projects(id),
  subject TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  duration_months INTEGER,
  valid_from TEXT,
  valid_to TEXT,
  total_value REAL,
  original_pdf_path TEXT,
  extracted_text TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 19.6 work_order_items
```sql
CREATE TABLE work_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  sl_no INTEGER,
  description TEXT NOT NULL,
  unit TEXT,
  contracted_qty REAL,
  rate REAL NOT NULL,
  amount REAL,
  cumulative_billed_qty REAL DEFAULT 0,
  sub_work_ref TEXT
);
```

### 19.7 invoices
```sql
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  billing_period_from TEXT,
  billing_period_to TEXT,
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
  ai_description_used INTEGER DEFAULT 0,
  total_taxable REAL,
  total_cgst REAL DEFAULT 0,
  total_sgst REAL DEFAULT 0,
  total_igst REAL DEFAULT 0,
  total_tax REAL,
  total_invoice_amount REAL,
  tds_amount REAL,
  advance_amount REAL DEFAULT 0,
  net_payable REAL,
  amount_in_words TEXT,
  pdf_file_path TEXT,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now')),
  last_modified_at TEXT,
  modification_reason TEXT,
  payment_status TEXT DEFAULT 'unpaid',
  amount_received REAL DEFAULT 0,
  received_date TEXT,
  tds_certificate_received INTEGER DEFAULT 0,
  notes TEXT
);
```

### 19.8 invoice_line_items
```sql
CREATE TABLE invoice_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  sl_no INTEGER NOT NULL,
  work_order_item_id INTEGER REFERENCES work_order_items(id),
  description TEXT NOT NULL,
  vehicle_summary TEXT,
  sac_code TEXT DEFAULT '997319',
  unit TEXT DEFAULT 'CUM',
  qty REAL,
  rate REAL,
  discount REAL DEFAULT 0,
  taxable_value REAL,
  cgst_rate REAL DEFAULT 0,
  cgst_amount REAL DEFAULT 0,
  sgst_rate REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0,
  igst_rate REAL DEFAULT 0,
  igst_amount REAL DEFAULT 0,
  line_total REAL,
  rate_overridden INTEGER DEFAULT 0,
  override_reason TEXT
);
```

### 19.9 invoice_vehicles
```sql
CREATE TABLE invoice_vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id)
);
```

---

## 20. Application Screens

### 20.1 Dashboard
Operational graphs, KPIs, flags, calendar, utilization, FY toggle.

### 20.2 New Bill
Main bill creation wizard.

### 20.3 Invoice History
Browse, filter, edit, duplicate, review.

### 20.4 Work Orders
Upload, review extraction, manage statuses, monitor utilization.

### 20.5 Clients
Client master management.

### 20.6 Vehicles
Vehicle master management.

### 20.7 Projects
Optional structured project references.

### 20.8 Settings
Business, invoice numbering, GST/TDS defaults, PDF styling, storage paths.

---

## 21. Recommended Technical Stack

### Preferred Architecture
**Desktop-first app** for simplicity and offline operation.

Recommended stack:
- **Electron** for desktop shell
- **React** for UI
- **SQLite** for local database
- **PDF generation via HTML-to-PDF approach** using a browser rendering engine (for precise invoice output)
- OCR / document parsing integration for work-order extraction
- AI service abstraction layer for description assistance and parsing help

### Why Desktop-First
- Works offline
- Suitable for single-business daily use
- Easier local PDF file storage and replacement
- Easier file upload / scan management

---

## 22. Operational Rules and Warnings

### 22.1 No-Restriction Philosophy with Strong Warnings
The app should not be too rigid. It should warn more than it blocks.

Warnings should be used for:
- no valid work order
- expired work order
- rate override
- quantity exceeding expected contract quantity
- vague description
- future invoice date
- different FY date
- client GSTIN mismatch with POS

### 22.2 User Flexibility
User should still be able to:
- bill without work order
- edit final invoice
- override rate
- exceed work-order quantity
- manually rewrite description

But every such action should be visible and logged.

---

## 23. Dashboard Graph Ideas (Detailed)

Recommended charts for V2:
- Monthly billed value trend
- Taxable vs GST vs net payable trend
- Vehicle-wise invoice count
- Vehicle-wise billed amount contribution
- Work-order-wise billed quantity utilization
- Work-order expiry timeline
- Status donut: draft / final / cancelled
- Coverage donut: with WO / without WO
- Rate override count by month
- Payment status summary (if payment module enabled)

---

## 24. Suggested Future Enhancements

- WhatsApp share of generated PDF
- Email from app with attached invoice PDF
- Credit note / debit note module
- Payment reminder tracking
- TDS certificate reconciliation
- OCR confidence scoring for work-order extraction
- Role-based access if business grows
- Audit log screen
- Backup / restore with ZIP export
- Search by project keywords inside work-order text

---

## 25. Implementation Priorities

### Phase 1 — Core MVP
- Settings
- Clients
- Vehicles
- Invoice numbering
- PDF invoice generation
- Invoice history
- Edit-and-replace PDF

### Phase 2 — Work Order Intelligence
- Work order upload
- OCR extraction review
- Work-order-linked billing
- quantity/rate warnings
- coverage indicator

### Phase 3 — AI Assistance
- AI description generation
- vague input improvement
- rewrite suggestions

### Phase 4 — Dashboard and Insights
- KPI dashboard
- work order graphs
- vehicle analytics
- FY toggle
- billing calendar
- flags center

### Phase 5 — Advanced Controls
- payment tracking
- credit/debit note support
- sharing workflows
- audit reporting

---

## 26. Final Product Summary

V2 is no longer just an invoice generator. It is a **PDF-first GST billing and work-order management system** for Sri Vaishnav Constructions. It combines GST-compliant billing, internal edit control, work-order extraction, AI description assistance, vehicle-linked billing, and an operational dashboard into one offline-friendly desktop application. GST compliance depends on invoice content rather than Excel format, so a PDF-first approach is appropriate and more practical for day-to-day business use.[web:2][web:12]

The strongest product value comes from connecting all operational pieces together: valid work orders, selected items, selected vehicles, cleaner descriptions, billing-period coverage warnings, and dashboard visibility. That will make billing faster, more accurate, and far more organized than the current manual monthly process.
