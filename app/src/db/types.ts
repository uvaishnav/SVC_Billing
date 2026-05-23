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
  // Business Profile
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
  // Invoice Numbering
  invoice_prefix: string
  current_sequence: number
  sequence_padding: number
  last_invoice_number: string | null
  // GST & Billing Defaults
  default_sac_id: number | null
  default_tds_rate: number
  tds_applicable: boolean
  reverse_charge_applicable: boolean
  default_billing_period: string
  // Bank Default
  default_bank_account_id: number | null
}

export interface Client {
  id: number
  name: string
  address: string
  state: string
  state_code: string
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
}

export interface ClientGstin {
  id: number
  client_id: number
  state: string
  state_code: string
  gstin: string
  is_primary: boolean
  created_at: string
}

export interface ClientWithGstins extends Client {
  gstins: ClientGstin[]
}

// For Supabase createClient generic
export interface Database {
  public: {
    Tables: {
      settings: { Row: Settings; Insert: Partial<Settings>; Update: Partial<Settings> }
      bank_accounts: { Row: BankAccount; Insert: Omit<BankAccount, 'id' | 'created_at'>; Update: Partial<BankAccount> }
      sac_codes: { Row: SacCode; Insert: Omit<SacCode, 'id'>; Update: Partial<SacCode> }
      clients: { Row: Client; Insert: Omit<Client, 'id' | 'created_at'>; Update: Partial<Client> }
      client_gstins: { Row: ClientGstin; Insert: Omit<ClientGstin, 'id' | 'created_at'>; Update: Partial<ClientGstin> }
    }
  }
}
