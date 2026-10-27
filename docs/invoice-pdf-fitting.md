# Single-page invoice fitting

All invoice production paths call `generateInvoicePdf`: the draft preview and the saved-invoice modal (preview, download, mobile opening/sharing, and upload). The modal reuses one blob rather than independently rendering each action.

The generator renders the existing React PDF template at its original A4 width, but with automatic height and pagination disabled. Automatic height allows the entire footer and all rows to lay out naturally; disabling wrapping on a fixed A4 page alone would risk clipping content.

It reads the resulting PDF page height and subtracts the existing 32 pt top and 44 pt bottom margins. The scale is `min(1, (841.89 - 32 - 44) / contentHeight)`. It then embeds the original vector page onto a single A4 page using pdf-lib. Content remains top-aligned at 32 pt and horizontally centered. Fonts, images, spacing, borders, and aspect ratios scale together. Text remains selectable/searchable.

Already-fitting invoices retain their existing layout and font sizes. Overflowing invoices receive the largest uniform scale that fits. This uses actual line wrapping and font metrics instead of guessing from row counts. It uses public APIs and one layout pass; there is no iterative render/search loop or dependence on React PDF's private layout tree.

The deliberate tradeoff is that very long invoices have smaller text and wider side margins. A strict single-page requirement cannot preserve a minimum font size for arbitrarily much content. The generator does not truncate rows or silently switch to multiple pages.

## Validation

Run `cd app && npm run test:invoice-pdf` (requires access to the existing hosted invoice fonts). Synthetic PDFs are written to `/tmp/svc-invoice-fit-tests`, or to `INVOICE_TEST_OUTPUT` if specified. Tests cover quantity/rental invoices, additional rows and work items, long descriptions, both tax modes, and absent optional sections. They verify one A4 page, every text segment retained, text within margins, the exact required scale, and unchanged positions/font sizes for already-fitting invoices (within 0.001 pt rounding tolerance).

For visual inspection, render samples with Poppler: `pdftoppm -png -singlefile /tmp/svc-invoice-fit-tests/slight-overflow.pdf /tmp/svc-invoice-fit-tests/slight-overflow`.

## API references

- React PDF page size supports automatic height: https://react-pdf.org/docs/v3/components
- React PDF wrapping behavior: https://react-pdf.org/docs/v4/advanced/page-wrapping
- pdf-lib page embedding: https://pdf-lib.js.org/docs/api/classes/pdfdocument#embedpage
- pdf-lib proportional page drawing: https://pdf-lib.js.org/docs/api/classes/pdfpage#drawpage
