/**
 * buildInvoicePayload.ts
 * Fetches all required data for an invoice from Supabase and assembles InvoicePayload.
 * Single async function — all DB reads happen here so InvoiceDocument stays pure.
 */
import { supabase } from '../../../db/supabaseClient';
import type { InvoicePayload } from './invoicePayloadTypes';

export async function buildInvoicePayload(invoiceId: number): Promise<InvoicePayload> {
  // ── 1. Invoice row + FK joins ──────────────────────────────────────────────
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .select(`
      *,
      clients(name),
      client_gstins(gstin, address, state, state_code),
      sac_codes(sac_code),
      bank_accounts(bank_name, account_name, account_number, ifsc, branch),
      work_orders(wo_reference)
    `)
    .eq('id', invoiceId)
    .single();

  if (invErr || !inv) throw new Error(`Invoice ${invoiceId} not found: ${invErr?.message}`);

  // ── 2. Settings (supplier identity) ──────────────────────────────────────
  const { data: settings, error: settingsErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (settingsErr || !settings) throw new Error('Settings not found');

  // ── 3. Line items (branched on billing type) ───────────────────────────────
  let lineItems = undefined;
  let rentalItems = undefined;
  let distributionItems = undefined;

  if (inv.line_item_billing_type === 'rental') {
    // Rental items
    const { data: ri, error: riErr } = await supabase
      .from('invoice_rental_items')
      .select('*, vehicles(reg_number, vehicle_type)')
      .eq('invoice_id', invoiceId)
      .order('id');

    if (riErr) throw new Error(`Rental items fetch failed: ${riErr.message}`);

    rentalItems = (ri ?? []).map((r: any) => ({
      reg_number: r.vehicles?.reg_number ?? 'Unknown',
      vehicle_type: r.vehicles?.vehicle_type ?? null,
      billing_mode: r.billing_mode,
      num_days: r.num_days,
      monthly_rent: r.monthly_rent,
      subtotal: r.subtotal,
    }));

    // Distribution items
    const { data: di, error: diErr } = await supabase
      .from('invoice_item_distribution')
      .select('*, work_order_items(description)')
      .eq('invoice_id', invoiceId)
      .order('id');

    if (diErr) throw new Error(`Distribution fetch failed: ${diErr.message}`);

    distributionItems = (di ?? []).map((d: any) => ({
      description: d.work_order_items?.description ?? '–',
      allocation_pct: d.allocation_pct,
      allocated_amount: d.allocated_amount,
    }));
  } else {
    // Quantity line items
    const { data: li, error: liErr } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sl_no');

    if (liErr) throw new Error(`Line items fetch failed: ${liErr.message}`);

    lineItems = (li ?? []).map((l: any) => ({
      sl_no: l.sl_no,
      description: l.description,
      unit: l.unit,
      qty: l.qty,
      rate: l.rate,
      taxable_value: l.taxable_value,
    }));
  }

  // ── 4. Assemble payload ───────────────────────────────────────────────────
  return {
    inv: {
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      billing_from: inv.billing_from,
      billing_to: inv.billing_to,
      tax_mode: inv.tax_mode,
      reverse_charge: inv.reverse_charge,
      line_item_billing_type: inv.line_item_billing_type,
      sac_code: (inv as any).sac_codes?.sac_code ?? '',
      description: inv.description,
      wo_reference: (inv as any).work_orders?.wo_reference ?? null,
      total_taxable: inv.total_taxable,
      cgst_amount: inv.cgst_amount,
      sgst_amount: inv.sgst_amount,
      igst_amount: inv.igst_amount,
      total_invoice_amount: inv.total_invoice_amount,
      tds_amount: inv.tds_amount,
      net_receivable: inv.net_receivable,
    },
    supplier: {
      business_name: settings.business_name,
      address: settings.address,
      gstin: settings.gstin,
      pan: settings.pan,
      state: settings.state,
      state_code: settings.state_code,
      phone: settings.phone,
      email: settings.email,
      authorized_signatory: settings.authorized_signatory,
      logo_url: settings.logo_url,
    },
    client: {
      name: (inv as any).clients?.name ?? 'Unknown Client',
      address: (inv as any).client_gstins?.address ?? '',
      gstin: (inv as any).client_gstins?.gstin ?? '',
      state: (inv as any).client_gstins?.state ?? '',
      state_code: (inv as any).client_gstins?.state_code ?? '',
    },
    bank: {
      bank_name: (inv as any).bank_accounts?.bank_name ?? '',
      account_name: (inv as any).bank_accounts?.account_name ?? '',
      account_number: (inv as any).bank_accounts?.account_number ?? '',
      ifsc: (inv as any).bank_accounts?.ifsc ?? '',
      branch: (inv as any).bank_accounts?.branch ?? null,
    },
    lineItems,
    rentalItems,
    distributionItems,
  };
}
