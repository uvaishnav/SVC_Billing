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
  default_sac_id: number | null
  default_tds_rate: number
  tds_applicable: boolean
  reverse_charge_applicable: boolean
  default_billing_period: string
  default_bank_account_id: number | null
}

// clients — identity only (name, contact)
// address/state live on client_gstins (one per GST registration)
export interface Client {
  id: number
  name: string
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
}

// One row per GST registration.
// A client registered in multiple states has one row per state,
// each with its own address, state, state_code, and GSTIN.
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

// Vehicle — physical identity of a fleet vehicle.
// Unit-based rates are work-order-driven, not stored here.
// default_monthly_rent is nullable — used as a pre-fill hint for rental invoices.
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

export interface Database {
  public: {
    Tables: {
      settings:      { Row: Settings;    Insert: Partial<Settings>;                        Update: Partial<Settings> }
      bank_accounts: { Row: BankAccount; Insert: Omit<BankAccount, 'id' | 'created_at'>; Update: Partial<BankAccount> }
      sac_codes:     { Row: SacCode;     Insert: Omit<SacCode, 'id'>;                     Update: Partial<SacCode> }
      clients:       { Row: Client;      Insert: Omit<Client, 'id' | 'created_at'>;       Update: Partial<Client> }
      client_gstins: { Row: ClientGstin; Insert: Omit<ClientGstin, 'id' | 'created_at'>; Update: Partial<ClientGstin> }
      vehicles:      { Row: Vehicle;     Insert: Omit<Vehicle, 'id' | 'created_at'>;      Update: Partial<Vehicle> }
    }
  }
}
