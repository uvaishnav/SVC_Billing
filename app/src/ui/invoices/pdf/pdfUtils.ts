/**
 * pdfUtils.ts
 * Utilities for formatting currency, dates, and amount-in-words for the PDF.
 */

/** Format a number as Indian rupee string: ₹1,23,456.78 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '–';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format ISO date string to DD/MM/YYYY */
export function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Amount in words ───────────────────────────────────────────────────────────
const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
  'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function wordsBelow100(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
}

function wordsBelow1000(n: number): string {
  if (n < 100) return wordsBelow100(n);
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + wordsBelow100(n % 100) : '');
}

/** Convert a rupee amount to Indian place-value words (Crore / Lakh / Thousand) */
export function toWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let parts: string[] = [];
  let rem = rupees;

  if (rem >= 1_00_00_000) {
    parts.push(wordsBelow1000(Math.floor(rem / 1_00_00_000)) + ' Crore');
    rem %= 1_00_00_000;
  }
  if (rem >= 1_00_000) {
    parts.push(wordsBelow1000(Math.floor(rem / 1_00_000)) + ' Lakh');
    rem %= 1_00_000;
  }
  if (rem >= 1_000) {
    parts.push(wordsBelow100(Math.floor(rem / 1_000)) + ' Thousand');
    rem %= 1_000;
  }
  if (rem > 0) parts.push(wordsBelow1000(rem));

  let result = parts.length > 0 ? parts.join(' ') + ' Rupees' : 'Zero Rupees';
  if (paise > 0) result += ' and ' + wordsBelow100(paise) + ' Paise';
  result += ' Only';
  return result;
}
