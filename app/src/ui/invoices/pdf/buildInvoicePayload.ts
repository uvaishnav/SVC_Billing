/**
 * buildInvoicePayload.ts
 * Fetches all required data for an invoice from Supabase and assembles InvoicePdfProps.
 * Single async function — all DB reads happen here so InvoicePdf.tsx stays pure.
 *
 * Used by InvoicePreviewModal (invoice list view → preview from saved invoice row).
 * The hook usePdfPreview uses a different path (InvoiceDraft → InvoicePdfProps)
 * for the wizard preview flow.
 */
import { supabase } from '../../../db/supabaseClient';
import type { InvoicePdfProps, PdfLineItem, PdfRentalItem, PdfDistributionItem } from './invoicePayloadTypes';
import { toWords } from './pdfUtils';

export async function buildInvoicePayload(invoiceId: number): Promise<InvoicePdfProps> {
  // ── 1. Invoice row + FK joins ────────────────────────────────────────────────
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

  // ── 2. Settings (supplier identity) ─────────────────────────────────────────
  const { data: settings, error: settingsErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (settingsErr || !settings) throw new Error('Settings not found');

  // ── 3. Line items (branched on billing type) ─────────────────────────────────
  let lineItems: PdfLineItem[] = [];
  let rentalItems: PdfRentalItem[] = [];
  let distributionItems: PdfDistributionItem[] = [];

  const isRental = inv.line_item_billing_type === 'rental';

  if (isRental) {
    const { data: ri, error: riErr } = await supabase
      .from('invoice_rental_items')
      .select('*, vehicles(reg_number, vehicle_type)')
      .eq('invoice_id', invoiceId)
      .order('id');

    if (riErr) throw new Error(`Rental items fetch failed: ${riErr.message}`);

    rentalItems = (ri ?? []).map((r: any, idx: number): PdfRentalItem => ({
      sl_no:        idx + 1,
      reg_number:   r.vehicles?.reg_number ?? 'Unknown',
      vehicle_type: r.vehicles?.vehicle_type ?? '',
      billing_from: inv.billing_from,
      billing_to:   inv.billing_to,
      billing_mode: r.billing_mode ?? '',
      num_days:     r.num_days ?? 0,
      monthly_rent: r.monthly_rent ?? 0,
      amount:       r.subtotal ?? 0,
    }));

    const { data: di, error: diErr } = await supabase
      .from('invoice_item_distribution')
      .select('work_order_item_id, allocation_pct')
      .eq('invoice_id', invoiceId)
      .order('id');

    if (diErr) throw new Error(`Distribution fetch failed: ${diErr.message}`);

    const woItemIds: number[] = (di ?? []).map((d: any) => d.work_order_item_id).filter(Boolean);

    let woMap: Record<number, { description: string; sub_work_ref: string | null }> = {};
    if (woItemIds.length > 0) {
      const { data: woItems } = await supabase
        .from('work_order_items')
        .select('id, description, sub_work_ref')
        .in('id', woItemIds);
      woMap = Object.fromEntries(
        (woItems ?? []).map((w: any) => [w.id, { description: w.description, sub_work_ref: w.sub_work_ref ?? null }])
      );
    }

    distributionItems = (di ?? []).map((d: any): PdfDistributionItem => ({
      description:    woMap[d.work_order_item_id]?.description ?? '–',
      sub_work_ref:   woMap[d.work_order_item_id]?.sub_work_ref ?? null,
      allocation_pct: d.allocation_pct ?? 0,
    }));
  } else {
    const { data: li, error: liErr } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sl_no');

    if (liErr) throw new Error(`Line items fetch failed: ${liErr.message}`);

    lineItems = (li ?? []).map((l: any): PdfLineItem => ({
      sl_no:       l.sl_no,
      description: l.description,
      unit:        l.unit,
      qty:         l.qty,
      rate:        l.rate,
      amount:      l.taxable_value,
    }));
  }

  // ── 4. Totals — read directly from DB columns, no re-derivation ─────────────
  // All of these are persisted by draftToRow() via recomputeTotals().
  // buildInvoicePayload must be a pure reader — never re-derive what the wizard
  // already computed, to guarantee preview === final PDF.
  const taxMode: 'cgst_sgst' | 'igst' = inv.tax_mode;
  const totalTaxable: number  = inv.total_taxable  ?? 0;
  const cgst: number          = inv.cgst_amount     ?? 0;
  const sgst: number          = inv.sgst_amount     ?? 0;
  const igst: number          = inv.igst_amount     ?? 0;
  const totalGst: number      = inv.total_gst       ?? 0;
  const totalAmount: number   = inv.total_amount    ?? 0;
  const tdsAmount: number     = inv.tds_amount      ?? 0;
  const netReceivable: number = inv.net_receivable  ?? 0;
  const gstRate: number       = inv.gst_rate        ?? 0;
  const tdsRate: number       = inv.tds_rate        ?? 0;

  // ── 5. Assemble flat InvoicePdfProps ────────────────────────────────────────
  return {
    supplier: {
      business_name:        settings.business_name,
      address:              settings.address,
      gstin:                settings.gstin,
      pan:                  settings.pan,
      phone:                settings.phone,
      email:                settings.email,
      state:                settings.state,
      state_code:           settings.state_code,
      authorized_signatory: settings.authorized_signatory,
      logo_url:             settings.logo_url ?? null,
    },
    invoice_number:       inv.invoice_number,
    invoice_date:         inv.invoice_date,
    billing_from:         inv.billing_from,
    billing_to:           inv.billing_to,
    place_of_supply:      inv.place_of_supply ?? '',
    place_of_supply_code: inv.place_of_supply_code ?? '',
    reverse_charge:       inv.reverse_charge ?? false,
    work_order_reference: (inv as any).work_orders?.wo_reference ?? null,
    recipient: (inv as any).client_gstins
      ? {
          name:       (inv as any).clients?.name ?? 'Unknown',
          gstin:      (inv as any).client_gstins?.gstin ?? null,
          address:    (inv as any).client_gstins?.address ?? '',
          state:      (inv as any).client_gstins?.state ?? '',
          state_code: (inv as any).client_gstins?.state_code ?? '',
        }
      : null,
    sac_code:            (inv as any).sac_codes?.sac_code ?? null,
    // overall_description is stored in the invoices.overall_description column.
    // (NOT inv.description — that field does not exist on the invoices table.)
    overall_description: inv.overall_description ?? '',
    billing_type:        isRental ? 'rental' : 'quantity',
    tax_mode:            taxMode,
    line_items:          lineItems,
    rental_items:        rentalItems,
    item_distribution:   distributionItems,
    total_taxable:       totalTaxable,
    gst_rate:            gstRate,
    cgst_amount:         cgst,
    sgst_amount:         sgst,
    igst_amount:         igst,
    total_gst:           totalGst,
    total_amount:        totalAmount,
    tds_rate:            tdsRate,
    tds_amount:          tdsAmount,
    net_receivable:      netReceivable,
    // amount_in_words is stored by recomputeTotals() using total_amount.
    // Use the stored value; fall back to re-computing from total_amount only.
    amount_in_words:     inv.amount_in_words ?? toWords(totalAmount),
    bank: (inv as any).bank_accounts
      ? {
          bank_name:      (inv as any).bank_accounts.bank_name,
          account_name:   (inv as any).bank_accounts.account_name,
          account_number: (inv as any).bank_accounts.account_number,
          ifsc:           (inv as any).bank_accounts.ifsc,
          branch:         (inv as any).bank_accounts.branch ?? null,
        }
      : null,
  };
}
