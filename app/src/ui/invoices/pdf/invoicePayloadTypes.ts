/**
 * invoicePayloadTypes.ts
 * Shape of the data object passed into InvoiceDocument.
 * Assembled by buildInvoicePayload() from DB row + joins.
 */

export interface SupplierPayload {
  business_name: string;
  address: string;
  gstin: string;
  pan?: string | null;
  state: string;
  state_code: string;
  phone?: string | null;
  email?: string | null;
  authorized_signatory: string;
  logo_url?: string | null;
}

export interface ClientPayload {
  name: string;
  address: string;
  gstin: string;
  state: string;
  state_code: string;
}

export interface BankPayload {
  bank_name: string;
  account_name: string;
  account_number: string;
  ifsc: string;
  branch?: string | null;
}

export interface InvoiceMetaPayload {
  invoice_number: string;
  invoice_date: string;     // ISO date string
  billing_from: string;
  billing_to: string;
  tax_mode: 'cgst_sgst' | 'igst';
  reverse_charge: boolean;
  line_item_billing_type: 'quantity' | 'rental';
  sac_code: string;         // just the numeric code, e.g. "996601"
  description?: string | null;
  wo_reference?: string | null;
  // Totals
  total_taxable: number;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  total_invoice_amount: number;
  tds_amount?: number | null;
  net_receivable?: number | null;
}

export interface QuantityLineItemPayload {
  sl_no: number;
  description: string;
  unit?: string | null;
  qty: number;
  rate: number;
  taxable_value: number;
}

export interface RentalLineItemPayload {
  reg_number: string;
  vehicle_type?: string | null;
  billing_mode: 'full_month' | 'partial_days';
  num_days?: number | null;
  monthly_rent: number;
  subtotal: number;
}

export interface DistributionItemPayload {
  description: string;
  allocation_pct: number;
  allocated_amount: number;
}

export interface InvoicePayload {
  inv: InvoiceMetaPayload;
  supplier: SupplierPayload;
  client: ClientPayload;
  bank: BankPayload;
  lineItems?: QuantityLineItemPayload[];
  rentalItems?: RentalLineItemPayload[];
  distributionItems?: DistributionItemPayload[];
}
