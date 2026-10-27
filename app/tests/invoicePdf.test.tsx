import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pdf } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { InvoicePdf } from '../src/ui/invoices/pdf/InvoicePdf';
import { generateInvoicePdf } from '../src/ui/invoices/pdf/generateInvoicePdf';
import type { InvoicePdfProps } from '../src/ui/invoices/pdf/invoicePayloadTypes';

const base: InvoicePdfProps = {
  supplier: { business_name: 'SVC CONSTRUCTIONS', address: '12 Industrial Road, Hyderabad, Telangana',
    gstin: '36ABCDE1234F1Z5', pan: 'ABCDE1234F', phone: '9876543210', email: 'billing@example.com',
    state: 'Telangana', state_code: '36', authorized_signatory: 'Test Signatory' },
  invoice_number: 'SVC/2026/001', invoice_date: '2026-10-27', billing_from: '2026-10-01', billing_to: '2026-10-31',
  place_of_supply: 'Telangana', place_of_supply_code: '36', supplier_state_code: '36', reverse_charge: false,
  work_order_reference: 'WO-2026-001', project_name: 'Road Construction', site_location: 'Hyderabad',
  recipient: { name: 'Example Infrastructure Ltd', gstin: '36ABCDE5678G1Z2', address: '45 Business Park, Hyderabad', state: 'Telangana', state_code: '36' },
  sac_code: '995433', overall_description: 'Equipment rental for construction services during October 2026.',
  billing_type: 'rental', tax_mode: 'cgst_sgst', line_items: [], rental_items: [], item_distribution: [],
  total_taxable: 100000, gst_rate: 18, total_gst: 18000, total_amount: 118000, tds_rate: 2, tds_amount: 2000,
  net_receivable: 116000, amount_in_words: 'One Lakh Sixteen Thousand Rupees Only',
  bank: { bank_name: 'Example Bank', account_name: 'SVC Constructions', account_number: '123456789012', ifsc: 'EXAM0001234', branch: 'Hyderabad' },
};
function fixture(rows: number, workItems: number, quantity = false, long = false): InvoicePdfProps {
  return { ...base, billing_type: quantity ? 'quantity' : 'rental',
    overall_description: long ? base.overall_description.repeat(12) : base.overall_description,
    line_items: Array.from({ length: rows }, (_, i) => ({ sl_no: i + 1, description: `QuantityItem${i + 1} excavation and earthwork ${long ? 'including site preparation and transportation '.repeat(5) : ''}`, unit: 'Cu.m', qty: 10, rate: 1000, amount: 10000 })),
    rental_items: Array.from({ length: rows }, (_, i) => ({ sl_no: i + 1, reg_number: `TS09AB${1000 + i}`, vehicle_type: 'Excavator', billing_from: base.billing_from, billing_to: base.billing_to, billing_mode: 'full_month', num_days: 31, monthly_rent: 100000, amount: 100000, shift: i % 2 ? 'day_night' : 'day' })),
    item_distribution: Array.from({ length: workItems }, (_, i) => ({ description: `WorkItem${i + 1} site clearance ${long ? 'and excavation with transport to disposal site '.repeat(6) : ''}`, sub_work_ref: `SUB-${i + 1}`, allocation_pct: 100 / workItems })),
  };
}
async function inspect(blob: Blob) {
  const bytes = await blob.arrayBuffer();
  const document = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  assert.equal(document.numPages, 1, 'must be one page');
  const page = await document.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.filter((item): item is Extract<typeof item, { str: string }> => 'str' in item && !!item.str.trim());
  const text = items.map(item => item.str).join(' ');
  const dimensions = page.getViewport({ scale: 1 });
  const info = { text, items, width: dimensions.width, height: dimensions.height };
  await document.destroy();
  return info;
}
const outputDir = process.env.INVOICE_TEST_OUTPUT ?? '/tmp/svc-invoice-fit-tests';
await mkdir(outputDir, { recursive: true });
for (const [name, props] of [
  ['short', fixture(1, 1)], ['extra-row', fixture(2, 1)], ['extra-work-item', fixture(1, 2)],
  ['slight-overflow', fixture(4, 3)], ['many-items', fixture(12, 8)], ['long-quantity', fixture(7, 0, true, true)],
  ['igst', { ...fixture(3, 4), tax_mode: 'igst' as const }],
  ['minimal', { ...fixture(1, 0, true), bank: null, recipient: null, sac_code: null, project_name: null, site_location: null }],
] as const) {
  const blob = await generateInvoicePdf(props);
  await writeFile(`${outputDir}/${name}.pdf`, new Uint8Array(await blob.arrayBuffer()));
  const fitted = await inspect(blob);
  assert.ok(Math.abs(fitted.width - 595.28) < 0.01);
  assert.ok(Math.abs(fitted.height - 841.89) < 0.01);
  assert.ok(fitted.text.includes('Test Signatory'), 'footer retained');
  assert.ok(fitted.text.includes('116,000.00') || fitted.text.includes('1,16,000.00'), 'total retained');
  for (const item of fitted.items) {
    assert.ok(item.transform[5] >= 43, `${name}: text below bottom margin: ${item.str}`);
    assert.ok(item.transform[4] >= 31, `${name}: text outside left margin: ${item.str}`);
    assert.ok(item.transform[4] + item.width <= 564.3, `${name}: text outside right margin: ${item.str}`);
  }
  for (let i = 1; i <= props.item_distribution.length; i++) assert.ok(fitted.text.includes(`WorkItem${i}`));
  if (props.billing_type === 'rental') {
    for (const item of props.rental_items) assert.ok(fitted.text.includes(item.reg_number));
  } else {
    for (let i = 1; i <= props.line_items.length; i++) assert.ok(fitted.text.includes(`QuantityItem${i}`));
  }
  const natural = await pdf(<InvoicePdf {...props} naturalHeight />).toBlob();
  const naturalInfo = await inspect(natural);
  const naturalHeight = (await PDFDocument.load(await natural.arrayBuffer())).getPage(0).getHeight();
  const expectedScale = Math.min(1, (841.89 - 76) / (naturalHeight - 76));
  assert.equal(fitted.items.length, naturalInfo.items.length, 'every text segment retained');
  for (let i = 0; i < fitted.items.length; i++) {
    assert.equal(fitted.items[i].str, naturalInfo.items[i].str);
    assert.ok(Math.abs(fitted.items[i].height / naturalInfo.items[i].height - expectedScale) < 0.00001, 'minimal uniform scale');
  }
  if (expectedScale === 1) {
    const original = await pdf(<InvoicePdf {...props} />).toBlob();
    const originalInfo = await inspect(original);
    assert.equal(fitted.items.length, originalInfo.items.length);
    for (let i = 0; i < fitted.items.length; i++) {
      assert.equal(fitted.items[i].str, originalInfo.items[i].str);
      fitted.items[i].transform.forEach((value, j) => assert.ok(Math.abs(value - originalInfo.items[i].transform[j]) < 0.001, 'already fitting invoice appearance unchanged'));
    }
    await writeFile(`${outputDir}/${name}-original.pdf`, new Uint8Array(await original.arrayBuffer()));
  }
  console.log(`${name}: one A4 page, scale ${(expectedScale * 100).toFixed(2)}%, all text retained`);
}
