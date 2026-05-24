// Auto-maintained types for all Supabase tables
// Update this file whenever the schema changes

export interface SacCode {
  id: number
  nickname: string
  sac_code: string
  description: string | null
  is_active: boolean
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

export interface Database {
  public: {
    Tables: {
      settings:         { Row: Settings;    Insert: Partial<Settings>;                           Update: Partial<Settings> }
      bank_accounts:    { Row: BankAccount; Insert: Omit<BankAccount, 'id' | 'created_at'>;    Update: Partial<BankAccount> }
      sac_codes:        { Row: SacCode;     Insert: Omit<SacCode, 'id'>;                        Update: Partial<SacCode> }
      clients:          { Row: Client;      Insert: Omit<Client, 'id' | 'created_at'>;          Update: Partial<Client> }
      client_gstins:    { Row: ClientGstin; Insert: Omit<ClientGstin, 'id' | 'created_at'>;    Update: Partial<ClientGstin> }
      vehicles:         { Row: Vehicle;     Insert: Omit<Vehicle, 'id' | 'created_at'>;         Update: Partial<Vehicle> }
      projects:         { Row: Project;     Insert: Omit<Project, 'id' | 'created_at'>;         Update: Partial<Project> }
      work_orders:      { Row: WorkOrder;   Insert: Omit<WorkOrder, 'id' | 'created_at'>;       Update: Partial<WorkOrder> }
      work_order_items: { Row: WorkOrderItem; Insert: Omit<WorkOrderItem, 'id' | 'created_at'>; Update: Partial<WorkOrderItem> }
    }
  }
}
