// Auto-maintained types for all Supabase tables
// Update this file whenever the schema changes

export interface SacCode {
  id: number
  nickname: string
  sac_code: string
  description: string | null
  is_active: boolean
  // Migration 006: which billing type this SAC code is valid for
  applicable_billing_type: 'quantity' | 'rental' | 'both'
}

export interface BankAccount {
  id: number
  nickname: string
  account_name: string
  account_number: string
  ifsc: string
  bank_name: string
  branch: string | null
  is_active: boolean
  created_at: string
}

export interface Settings {
  id: number
  business_name: string
  address: string
  gstin: string
  pan: string | null
  state: string
  state_code: string
  phone: string | null
  email: string | null
  authorized_signatory: string
  logo_url: string | null
  invoice_prefix: string
  current_sequence: number
  sequence_padding: number
  last_invoice_number: string | null
  last_fy: string | null
  default_sac_id: number | null
  default_tds_rate: number
  tds_applicable: boolean
  reverse_charge_applicable: boolean
  default_billing_period: string
  default_bank_account_id: number | null
}

export interface Client {
  id: number
  name: string
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
}

export interface ClientGstin {
  id: number
  client_id: number
  gstin: string
  state: string
  state_code: string
  address: string
  is_primary: boolean
  created_at: string
}

export interface ClientWithGstins extends Client {
  gstins: ClientGstin[]
}

export interface Vehicle {
  id: number
  reg_number: string
  vehicle_type: string | null
  capacity: number | null
  capacity_unit: string | null
  default_monthly_rent: number | null
  is_active: boolean
  notes: string | null
  created_at: string
}

// ─── Projects ────────────────────────────────────────────────
export interface Project {
  id: number
  name: string
  full_subject: string | null
  site_location: string | null
  client_id: number | null
  place_of_supply: string
  state_code: string
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface ProjectWithClient extends Project {
  client_name: string | null
}

// ─── Work Orders ─────────────────────────────────────────────
export type WorkOrderStatus = 'active' | 'expiring_soon' | 'expired' | 'closed'
export type BillingType = 'monthly_ra' | 'milestone' | 'adhoc'

export interface WorkOrder {
  id: number
  wo_reference: string | null
  client_id: number | null
  project_id: number | null
  subject: string
  issue_date: string
  duration_months: number | null
  valid_from: string | null
  valid_to: string | null
  total_value: number | null
  rates_firm: boolean
  tds_applicable: boolean
  billing_type: BillingType
  original_pdf_url: string | null
  extracted_text: string | null
  status: WorkOrderStatus
  notes: string | null
  created_at: string
}

export interface WorkOrderWithClient extends WorkOrder {
  client_name: string | null
  project_name: string | null
}

// ─── Work Order Items ─────────────────────────────────────────
export interface WorkOrderItem {
  id: number
  work_order_id: number
  sl_no: number | null
  description: string
  sub_work_ref: string | null
  unit: string | null
  contracted_qty: number | null
  rate: number
  amount: number | null
  cumulative_billed_qty: number
  created_at: string
}

// ─── Invoices ────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'final' | 'cancelled'
export type TaxMode = 'cgst_sgst' | 'igst'
// Migration 006: invoice-level billing type — drives Section 2 UI + PDF layout
export type InvoiceBillingType = 'quantity' | 'rental'

export interface Invoice {
  id: number
  invoice_number: string
  invoice_date: string
  billing_from: string
  billing_to: string

  client_id: number | null
  client_gstin_id: number | null
  work_order_id: number | null

  tax_mode: TaxMode
  place_of_supply: string
  place_of_supply_code: string
  reverse_charge: boolean

  // Migration 006: 'quantity' | 'rental' — default 'quantity'
  line_item_billing_type: InvoiceBillingType

  total_taxable: number
  gst_rate: number
  total_gst: number
  total_amount: number
  tds_rate: number
  tds_amount: number
  net_receivable: number
  amount_in_words: string | null

  overall_description: string | null

  bank_account_id: number | null
  sac_id: number | null

  status: InvoiceStatus
  created_at: string
  updated_at: string
}

export interface InvoiceLineItem {
  id: number
  invoice_id: number
  work_order_item_id: number | null
  sl_no: number
  description: string
  sac_id: number | null
  unit: string | null
  qty: number
  rate: number
  taxable_value: number
  rate_overridden: boolean
  created_at: string
}

export interface InvoiceVehicle {
  id: number
  invoice_id: number
  vehicle_id: number
  include_in_description: boolean
}

// ─── Rental billing types (Migration 006) ────────────────────

// One row per vehicle per rental invoice.
// SUM(subtotal) across all rows for one invoice = invoices.total_taxable
export type RentalBillingMode = 'full_month' | 'partial_days'

export interface InvoiceRentalItem {
  id: number
  invoice_id: number
  vehicle_id: number | null         // nullable — vehicle may be soft-deleted later
  sort_order: number
  billing_mode: RentalBillingMode
  num_days: number | null           // only set when billing_mode = 'partial_days'
  monthly_rent: number              // snapshot at invoice time
  subtotal: number                  // computed: full = monthly_rent; partial = (monthly_rent/30)*num_days
  created_at: string
}

// In-memory draft for one rental vehicle row (wizard Section 2)
export interface InvoiceRentalItemDraft {
  vehicle_id: number | null
  reg_number: string                // for display only
  vehicle_type: string | null       // for display only
  billing_mode: RentalBillingMode
  num_days: number | null
  monthly_rent: number
  subtotal: number                  // auto-computed, read-only in UI
  sort_order: number
}

// One row per WO item — distributes rental invoice total for cumulative_billed_qty tracking.
// RENTAL invoices only. For quantity invoices, distribution is implicit in invoice_line_items.
export interface InvoiceItemDistribution {
  id: number
  invoice_id: number
  work_order_item_id: number
  allocation_pct: number            // 0–100; sum across invoice should equal 100
  allocated_amount: number          // allocation_pct × total_taxable / 100
  created_at: string
}

// In-memory draft for one distribution row (wizard Section 2, rental only)
export interface InvoiceItemDistributionDraft {
  work_order_item_id: number
  description: string               // WO item description, for display
  sub_work_ref: string | null       // for display
  allocation_pct: number
  allocated_amount: number          // auto-computed from pct
}

// ─── Vehicle Billing Ledger (Migration 006) ───────────────────
// Analytics table — written on finalize, deleted on cancel.
// Never written manually by the user.
export interface VehicleBillingLedger {
  id: number
  vehicle_id: number
  invoice_id: number
  work_order_id: number | null
  financial_year: string            // e.g. '25-26' — same format as settings.last_fy
  billing_month: string             // e.g. '2026-05' (YYYY-MM) from invoices.billing_from
  billing_type: InvoiceBillingType  // 'quantity' | 'rental'
  amount: number                    // rental: exact subtotal; quantity: total_taxable / num_vehicles
  created_at: string
}

// ─── Rich joined types ────────────────────────────────────────

// Used in wizard and list page
export interface InvoiceWithDetails extends Invoice {
  client_name: string | null
  client_gstin: string | null
  client_address: string | null
  work_order_reference: string | null
  // Quantity invoice children
  line_items: InvoiceLineItem[]
  vehicles: (InvoiceVehicle & { reg_number: string; vehicle_type: string | null })[]
  // Rental invoice children
  rental_items: (InvoiceRentalItem & { reg_number: string | null; vehicle_type: string | null })[]
  item_distribution: InvoiceItemDistribution[]
}

// ─── Wizard draft state (in-memory, not persisted until save) ─
export interface InvoiceLineDraft {
  work_order_item_id: number | null
  sl_no: number
  description: string
  sac_id: number | null
  unit: string | null
  qty: number
  rate: number
  taxable_value: number
  rate_overridden: boolean
}

export interface InvoiceVehicleDraft {
  vehicle_id: number
  reg_number: string
  vehicle_type: string | null
  include_in_description: boolean
}

export interface InvoiceDraft {
  // Section 1 — Header
  invoice_number: string
  invoice_date: string
  billing_from: string
  billing_to: string
  client_id: number | null
  client_gstin_id: number | null
  work_order_id: number | null
  sac_id: number | null
  bank_account_id: number | null
  tax_mode: TaxMode
  place_of_supply: string
  place_of_supply_code: string
  reverse_charge: boolean
  // Migration 006: billing type selected in Section 1, drives Section 2 UI
  line_item_billing_type: InvoiceBillingType

  // Section 2 — Line items (quantity invoices)
  line_items: InvoiceLineDraft[]

  // Section 2 — Rental items + distribution (rental invoices)
  rental_items: InvoiceRentalItemDraft[]
  item_distribution: InvoiceItemDistributionDraft[]

  // Section 3 — Vehicles + Description
  // For quantity invoices: vehicles list is used
  // For rental invoices: vehicles are embedded in rental_items; this list is NOT populated
  vehicles: InvoiceVehicleDraft[]
  overall_description: string

  // Section 4 — Computed totals (no user input)
  total_taxable: number
  gst_rate: number
  total_gst: number
  total_amount: number
  tds_rate: number
  tds_amount: number
  net_receivable: number
  amount_in_words: string
}

// ─── Database interface map ───────────────────────────────────
export interface Database {
  public: {
    Tables: {
      settings:                    { Row: Settings;                    Insert: Partial<Settings>;                                           Update: Partial<Settings> }
      bank_accounts:               { Row: BankAccount;                 Insert: Omit<BankAccount, 'id' | 'created_at'>;                      Update: Partial<BankAccount> }
      sac_codes:                   { Row: SacCode;                     Insert: Omit<SacCode, 'id'>;                                          Update: Partial<SacCode> }
      clients:                     { Row: Client;                      Insert: Omit<Client, 'id' | 'created_at'>;                            Update: Partial<Client> }
      client_gstins:               { Row: ClientGstin;                 Insert: Omit<ClientGstin, 'id' | 'created_at'>;                       Update: Partial<ClientGstin> }
      vehicles:                    { Row: Vehicle;                     Insert: Omit<Vehicle, 'id' | 'created_at'>;                           Update: Partial<Vehicle> }
      projects:                    { Row: Project;                     Insert: Omit<Project, 'id' | 'created_at'>;                           Update: Partial<Project> }
      work_orders:                 { Row: WorkOrder;                   Insert: Omit<WorkOrder, 'id' | 'created_at'>;                         Update: Partial<WorkOrder> }
      work_order_items:            { Row: WorkOrderItem;               Insert: Omit<WorkOrderItem, 'id' | 'created_at'>;                     Update: Partial<WorkOrderItem> }
      invoices:                    { Row: Invoice;                     Insert: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>;            Update: Partial<Invoice> }
      invoice_line_items:          { Row: InvoiceLineItem;             Insert: Omit<InvoiceLineItem, 'id' | 'created_at'>;                   Update: Partial<InvoiceLineItem> }
      invoice_vehicles:            { Row: InvoiceVehicle;              Insert: Omit<InvoiceVehicle, 'id'>;                                   Update: Partial<InvoiceVehicle> }
      invoice_rental_items:        { Row: InvoiceRentalItem;           Insert: Omit<InvoiceRentalItem, 'id' | 'created_at'>;                 Update: Partial<InvoiceRentalItem> }
      invoice_item_distribution:   { Row: InvoiceItemDistribution;     Insert: Omit<InvoiceItemDistribution, 'id' | 'created_at'>;           Update: Partial<InvoiceItemDistribution> }
      vehicle_billing_ledger:      { Row: VehicleBillingLedger;        Insert: Omit<VehicleBillingLedger, 'id' | 'created_at'>;              Update: Partial<VehicleBillingLedger> }
    }
  }
}
