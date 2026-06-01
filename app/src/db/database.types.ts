export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          branch: string | null
          created_at: string | null
          id: number
          ifsc: string
          is_active: boolean | null
          nickname: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          branch?: string | null
          created_at?: string | null
          id?: number
          ifsc: string
          is_active?: boolean | null
          nickname: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          branch?: string | null
          created_at?: string | null
          id?: number
          ifsc?: string
          is_active?: boolean | null
          nickname?: string
        }
        Relationships: []
      }
      client_gstins: {
        Row: {
          address: string | null
          client_id: number
          created_at: string
          gstin: string
          id: number
          is_primary: boolean
          state: string
          state_code: string
        }
        Insert: {
          address?: string | null
          client_id: number
          created_at?: string
          gstin: string
          id?: number
          is_primary?: boolean
          state: string
          state_code: string
        }
        Update: {
          address?: string | null
          client_id?: number
          created_at?: string
          gstin?: string
          id?: number
          is_primary?: boolean
          state?: string
          state_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_gstins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: number
          is_active: boolean
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: number
          is_active?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: number
          is_active?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      dashboard_ignores: {
        Row: {
          id: number
          ignored_at: string
          note: string | null
          vehicle_id: number
          year_month: string
        }
        Insert: {
          id?: number
          ignored_at?: string
          note?: string | null
          vehicle_id: number
          year_month: string
        }
        Update: {
          id?: number
          ignored_at?: string
          note?: string | null
          vehicle_id?: number
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_ignores_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_item_distribution: {
        Row: {
          allocated_amount: number
          allocation_pct: number
          created_at: string | null
          id: number
          invoice_id: number
          work_order_item_id: number
        }
        Insert: {
          allocated_amount: number
          allocation_pct: number
          created_at?: string | null
          id?: number
          invoice_id: number
          work_order_item_id: number
        }
        Update: {
          allocated_amount?: number
          allocation_pct?: number
          created_at?: string | null
          id?: number
          invoice_id?: number
          work_order_item_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_iid_work_order_item"
            columns: ["work_order_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_item_distribution_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_item_distribution_work_order_item_id_fkey"
            columns: ["work_order_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: number
          invoice_id: number
          qty: number
          rate: number
          rate_overridden: boolean
          sac_id: number | null
          sl_no: number
          taxable_value: number
          unit: string | null
          work_order_item_id: number | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: number
          invoice_id: number
          qty?: number
          rate?: number
          rate_overridden?: boolean
          sac_id?: number | null
          sl_no?: number
          taxable_value?: number
          unit?: string | null
          work_order_item_id?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: number
          invoice_id?: number
          qty?: number
          rate?: number
          rate_overridden?: boolean
          sac_id?: number | null
          sl_no?: number
          taxable_value?: number
          unit?: string | null
          work_order_item_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_sac_id_fkey"
            columns: ["sac_id"]
            isOneToOne: false
            referencedRelation: "sac_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_work_order_item_id_fkey"
            columns: ["work_order_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_rental_items: {
        Row: {
          billing_mode: string
          created_at: string | null
          id: number
          invoice_id: number
          monthly_rent: number
          num_days: number | null
          sort_order: number
          subtotal: number
          vehicle_id: number | null
        }
        Insert: {
          billing_mode?: string
          created_at?: string | null
          id?: number
          invoice_id: number
          monthly_rent: number
          num_days?: number | null
          sort_order?: number
          subtotal: number
          vehicle_id?: number | null
        }
        Update: {
          billing_mode?: string
          created_at?: string | null
          id?: number
          invoice_id?: number
          monthly_rent?: number
          num_days?: number | null
          sort_order?: number
          subtotal?: number
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_rental_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_rental_items_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_vehicles: {
        Row: {
          id: number
          include_in_description: boolean
          invoice_id: number
          vehicle_id: number
        }
        Insert: {
          id?: number
          include_in_description?: boolean
          invoice_id: number
          vehicle_id: number
        }
        Update: {
          id?: number
          include_in_description?: boolean
          invoice_id?: number
          vehicle_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_vehicles_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_in_words: string | null
          bank_account_id: number | null
          billing_from: string
          billing_to: string
          client_gstin_id: number | null
          client_id: number | null
          created_at: string
          gst_rate: number
          id: number
          invoice_date: string
          invoice_number: string
          line_item_billing_type: string
          net_receivable: number
          overall_description: string | null
          pdf_url: string | null
          place_of_supply: string
          place_of_supply_code: string
          reverse_charge: boolean
          sac_id: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          tax_mode: Database["public"]["Enums"]["tax_mode"]
          tds_amount: number
          tds_rate: number
          total_amount: number
          total_gst: number
          total_taxable: number
          updated_at: string
          work_order_id: number | null
        }
        Insert: {
          amount_in_words?: string | null
          bank_account_id?: number | null
          billing_from: string
          billing_to: string
          client_gstin_id?: number | null
          client_id?: number | null
          created_at?: string
          gst_rate?: number
          id?: number
          invoice_date: string
          invoice_number: string
          line_item_billing_type?: string
          net_receivable?: number
          overall_description?: string | null
          pdf_url?: string | null
          place_of_supply?: string
          place_of_supply_code?: string
          reverse_charge?: boolean
          sac_id?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          tds_amount?: number
          tds_rate?: number
          total_amount?: number
          total_gst?: number
          total_taxable?: number
          updated_at?: string
          work_order_id?: number | null
        }
        Update: {
          amount_in_words?: string | null
          bank_account_id?: number | null
          billing_from?: string
          billing_to?: string
          client_gstin_id?: number | null
          client_id?: number | null
          created_at?: string
          gst_rate?: number
          id?: number
          invoice_date?: string
          invoice_number?: string
          line_item_billing_type?: string
          net_receivable?: number
          overall_description?: string | null
          pdf_url?: string | null
          place_of_supply?: string
          place_of_supply_code?: string
          reverse_charge?: boolean
          sac_id?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tax_mode?: Database["public"]["Enums"]["tax_mode"]
          tds_amount?: number
          tds_rate?: number
          total_amount?: number
          total_gst?: number
          total_taxable?: number
          updated_at?: string
          work_order_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_gstin_id_fkey"
            columns: ["client_gstin_id"]
            isOneToOne: false
            referencedRelation: "client_gstins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sac_id_fkey"
            columns: ["sac_id"]
            isOneToOne: false
            referencedRelation: "sac_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: number | null
          created_at: string | null
          full_subject: string | null
          id: number
          is_active: boolean
          name: string
          notes: string | null
          place_of_supply: string | null
          site_location: string | null
          state_code: string | null
        }
        Insert: {
          client_id?: number | null
          created_at?: string | null
          full_subject?: string | null
          id?: number
          is_active?: boolean
          name: string
          notes?: string | null
          place_of_supply?: string | null
          site_location?: string | null
          state_code?: string | null
        }
        Update: {
          client_id?: number | null
          created_at?: string | null
          full_subject?: string | null
          id?: number
          is_active?: boolean
          name?: string
          notes?: string | null
          place_of_supply?: string | null
          site_location?: string | null
          state_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_codes: {
        Row: {
          applicable_billing_type: string
          description: string | null
          id: number
          is_active: boolean | null
          nickname: string
          sac_code: string
        }
        Insert: {
          applicable_billing_type?: string
          description?: string | null
          id?: number
          is_active?: boolean | null
          nickname: string
          sac_code: string
        }
        Update: {
          applicable_billing_type?: string
          description?: string | null
          id?: number
          is_active?: boolean | null
          nickname?: string
          sac_code?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          address: string
          authorized_signatory: string
          business_name: string
          current_sequence: number
          default_bank_account_id: number | null
          default_billing_period: string
          default_sac_id: number | null
          default_tds_rate: number
          email: string | null
          gstin: string
          id: number
          invoice_prefix: string
          last_fy: string | null
          last_invoice_number: string | null
          logo_url: string | null
          pan: string | null
          phone: string | null
          reverse_charge_applicable: boolean
          sequence_padding: number
          state: string
          state_code: string
          tds_applicable: boolean
        }
        Insert: {
          address: string
          authorized_signatory: string
          business_name: string
          current_sequence?: number
          default_bank_account_id?: number | null
          default_billing_period?: string
          default_sac_id?: number | null
          default_tds_rate?: number
          email?: string | null
          gstin: string
          id?: number
          invoice_prefix?: string
          last_fy?: string | null
          last_invoice_number?: string | null
          logo_url?: string | null
          pan?: string | null
          phone?: string | null
          reverse_charge_applicable?: boolean
          sequence_padding?: number
          state?: string
          state_code?: string
          tds_applicable?: boolean
        }
        Update: {
          address?: string
          authorized_signatory?: string
          business_name?: string
          current_sequence?: number
          default_bank_account_id?: number | null
          default_billing_period?: string
          default_sac_id?: number | null
          default_tds_rate?: number
          email?: string | null
          gstin?: string
          id?: number
          invoice_prefix?: string
          last_fy?: string | null
          last_invoice_number?: string | null
          logo_url?: string | null
          pan?: string | null
          phone?: string | null
          reverse_charge_applicable?: boolean
          sequence_padding?: number
          state?: string
          state_code?: string
          tds_applicable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "settings_default_bank_account_id_fkey"
            columns: ["default_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_default_sac_id_fkey"
            columns: ["default_sac_id"]
            isOneToOne: false
            referencedRelation: "sac_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_billing_ledger: {
        Row: {
          amount: number
          billing_month: string
          billing_type: string
          created_at: string | null
          financial_year: string
          id: number
          invoice_id: number
          vehicle_id: number
          work_order_id: number | null
        }
        Insert: {
          amount: number
          billing_month: string
          billing_type: string
          created_at?: string | null
          financial_year: string
          id?: number
          invoice_id: number
          vehicle_id: number
          work_order_id?: number | null
        }
        Update: {
          amount?: number
          billing_month?: string
          billing_type?: string
          created_at?: string | null
          financial_year?: string
          id?: number
          invoice_id?: number
          vehicle_id?: number
          work_order_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_billing_ledger_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_billing_ledger_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_billing_ledger_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          capacity: number | null
          capacity_unit: string | null
          created_at: string
          default_monthly_rent: number | null
          id: number
          is_active: boolean
          notes: string | null
          reg_number: string
          vehicle_type: string | null
        }
        Insert: {
          capacity?: number | null
          capacity_unit?: string | null
          created_at?: string
          default_monthly_rent?: number | null
          id?: number
          is_active?: boolean
          notes?: string | null
          reg_number: string
          vehicle_type?: string | null
        }
        Update: {
          capacity?: number | null
          capacity_unit?: string | null
          created_at?: string
          default_monthly_rent?: number | null
          id?: number
          is_active?: boolean
          notes?: string | null
          reg_number?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
      work_order_items: {
        Row: {
          amount: number | null
          contracted_qty: number | null
          created_at: string | null
          cumulative_billed_qty: number
          description: string
          id: number
          rate: number
          sl_no: number | null
          sub_work_ref: string | null
          unit: string | null
          work_order_id: number
        }
        Insert: {
          amount?: number | null
          contracted_qty?: number | null
          created_at?: string | null
          cumulative_billed_qty?: number
          description: string
          id?: number
          rate: number
          sl_no?: number | null
          sub_work_ref?: string | null
          unit?: string | null
          work_order_id: number
        }
        Update: {
          amount?: number | null
          contracted_qty?: number | null
          created_at?: string | null
          cumulative_billed_qty?: number
          description?: string
          id?: number
          rate?: number
          sl_no?: number | null
          sub_work_ref?: string | null
          unit?: string | null
          work_order_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          billing_type: string
          client_id: number | null
          created_at: string | null
          duration_months: number | null
          extracted_text: string | null
          id: number
          issue_date: string
          notes: string | null
          original_pdf_url: string | null
          project_id: number | null
          rates_firm: boolean
          status: string
          subject: string
          tds_applicable: boolean
          total_value: number | null
          valid_from: string | null
          valid_to: string | null
          wo_reference: string | null
        }
        Insert: {
          billing_type?: string
          client_id?: number | null
          created_at?: string | null
          duration_months?: number | null
          extracted_text?: string | null
          id?: number
          issue_date: string
          notes?: string | null
          original_pdf_url?: string | null
          project_id?: number | null
          rates_firm?: boolean
          status?: string
          subject: string
          tds_applicable?: boolean
          total_value?: number | null
          valid_from?: string | null
          valid_to?: string | null
          wo_reference?: string | null
        }
        Update: {
          billing_type?: string
          client_id?: number | null
          created_at?: string | null
          duration_months?: number | null
          extracted_text?: string | null
          id?: number
          issue_date?: string
          notes?: string | null
          original_pdf_url?: string | null
          project_id?: number | null
          rates_firm?: boolean
          status?: string
          subject?: string
          tds_applicable?: boolean
          total_value?: number | null
          valid_from?: string | null
          valid_to?: string | null
          wo_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_billed_qty: {
        Args: { p_item_id: number; p_qty: number }
        Returns: undefined
      }
      get_next_invoice_number: { Args: never; Returns: string }
      increment_billed_qty: {
        Args: { p_item_id: number; p_qty: number }
        Returns: undefined
      }
    }
    Enums: {
      invoice_status: "draft" | "final" | "cancelled"
      tax_mode: "cgst_sgst" | "igst"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      invoice_status: ["draft", "final", "cancelled"],
      tax_mode: ["cgst_sgst", "igst"],
    },
  },
} as const
