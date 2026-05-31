/**
 * invoicePayloadTypes.ts
 * Single consolidated type for all PDF rendering props.
 * Used by InvoicePdf.tsx, usePdfPreview.ts, and buildInvoicePayload.ts.
 */

export interface PdfSupplier {
  business_name: string;
  address: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
  state: string;
  state_code: string;
  authorized_signatory: string;
  logo_url?: string | null;
}

export interface PdfRecipient {
  name: string;
  gstin?: string | null;
  address: string;
  state: string;
  state_code: string;
}

export interface PdfBankAccount {
  bank_name: string;
  account_name: string;
  account_number: string;
  ifsc: string;
  branch?: string | null;
}

export interface PdfLineItem {
  sl_no: number;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface PdfRentalItem {
  sl_no: number;
  reg_number: string;
  vehicle_type: string;
  billing_from: string;   // ISO date string
  billing_to: string;     // ISO date string
  billing_mode: string;
  num_days: number;
  monthly_rent: number;
  amount: number;
}

export interface PdfDistributionItem {
  description: string;
  sub_work_ref?: string | null;
  allocation_pct: number;
}

export interface InvoicePdfProps {
  // Supplier
  supplier: PdfSupplier;

  // Invoice identity
  invoice_number: string;
  invoice_date: string;

  // Invoice details block
  billing_from: string;
  billing_to: string;
  place_of_supply: string;
  place_of_supply_code: string;
  reverse_charge: boolean;
  work_order_reference?: string | null;

  // Recipient
  recipient: PdfRecipient | null;

  // SAC + description
  sac_code?: string | null;
  overall_description: string;

  // Billing type determines which table renders
  billing_type: 'quantity' | 'rental';

  // Tax mode determines accent colors
  tax_mode: 'cgst_sgst' | 'igst';

  // Line items (quantity billing)
  line_items: PdfLineItem[];

  // Rental items (rental billing)
  rental_items: PdfRentalItem[];

  // Work items distribution (rental only, optional)
  item_distribution: PdfDistributionItem[];

  // Totals
  total_taxable: number;
  gst_rate: number;
  total_gst: number;
  total_amount: number;
  tds_rate: number;
  tds_amount: number;
  net_receivable: number;
  amount_in_words: string;

  // Footer
  bank: PdfBankAccount | null;
}
