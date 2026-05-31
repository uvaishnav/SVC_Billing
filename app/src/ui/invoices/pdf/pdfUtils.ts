/**
 * pdfUtils.ts
 * Shared utilities for PDF generation:
 * - Brand color tokens (single source of truth — avoids circular imports)
 * - formatCurrency, toWords, formatDate helpers
 */

// ── Brand color tokens ───────────────────────────────────────────────────────────────
export const ESPRESSO  = '#3B2A1F';
export const BODY_TEXT = '#2A1F15';
export const MUTED     = '#6B5C4E';
export const FAINT     = '#9A8E84';
export const CREAM     = '#FAF8F3';
export const DIVIDER   = '#DDD5CC';
export const WHITE     = '#FFFFFF';

// Axis 1 — Tax mode accent
export const GOLD_ACCENT    = '#C8A96A';
export const GOLD_CHIP_BG   = '#FFF8ED';
export const STEEL_ACCENT   = '#4A7FA5';
export const STEEL_CHIP_BG  = '#EEF4FA';

// Axis 2 — Billing type table header
export const QTY_TABLE_HEADER_BG    = '#EDE9DE';
export const RENTAL_TABLE_HEADER_BG = '#E8EEF2';

// ── Currency formatter ────────────────────────────────────────────────────────────
const inrFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return inrFormatter.format(amount);
}

// ── Amount in words (Indian number system) ───────────────────────────────────────
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function wordsBelow100(n: number): string {
  if (n < 20) return ones[n];
  return (tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')).trim();
}

function wordsBelow1000(n: number): string {
  if (n < 100) return wordsBelow100(n);
  return (ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + wordsBelow100(n % 100) : '')).trim();
}

export function toWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const rupees  = Math.floor(rounded);
  const paiseRaw = Math.round((rounded - rupees) * 100);
  const paise  = paiseRaw === 100 ? 0 : paiseRaw;
  const rupeeAdj = paiseRaw === 100 ? rupees + 1 : rupees;

  if (rupeeAdj === 0 && paise === 0) return 'Zero Rupees Only';

  let result = '';
  let rem = rupeeAdj;

  if (rem >= 10_000_000) {
    result += wordsBelow1000(Math.floor(rem / 10_000_000)) + ' Crore ';
    rem %= 10_000_000;
  }
  if (rem >= 100_000) {
    result += wordsBelow1000(Math.floor(rem / 100_000)) + ' Lakh ';
    rem %= 100_000;
  }
  if (rem >= 1_000) {
    result += wordsBelow1000(Math.floor(rem / 1_000)) + ' Thousand ';
    rem %= 1_000;
  }
  if (rem > 0) {
    result += wordsBelow1000(rem) + ' ';
  }

  result = result.trim() + ' Rupees';
  if (paise > 0) result += ' and ' + wordsBelow100(paise) + ' Paise';
  result += ' Only';
  return result;
}

// ── Date formatter (DD MMM YYYY) ────────────────────────────────────────────────────
export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
