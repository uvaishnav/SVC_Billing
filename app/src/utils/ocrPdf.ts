// ocrPdf.ts
// Extracts text from a PDF file using pdfjs-dist (PDF → canvas) + Tesseract.js (canvas → text).
// Runs entirely in the browser — no server upload required.
// Returns concatenated text from all pages.

import * as pdfjsLib from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'

// Use the CDN worker so no local bundler config is needed
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs'

export interface OcrProgress {
  stage: 'loading_pdf' | 'rendering' | 'ocr' | 'done'
  page?: number
  totalPages?: number
  percent?: number  // 0–100
}

/**
 * Extract all text from a PDF file.
 * @param file  The PDF File object from an <input type="file">
 * @param onProgress  Optional callback for progress updates
 * @returns  Concatenated text from all pages
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  onProgress?.({ stage: 'loading_pdf' })

  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc      = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages  = pdfDoc.numPages

  const worker = await createWorker('eng', 1, {
    logger: () => {},  // Suppress verbose Tesseract logs
  })

  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.({
      stage: pageNum <= totalPages ? 'rendering' : 'ocr',
      page: pageNum,
      totalPages,
      percent: Math.round(((pageNum - 1) / totalPages) * 80),  // 0–80% for rendering
    })

    // Render page to canvas
    const page     = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 2.0 })  // scale 2 for better OCR accuracy
    const canvas   = document.createElement('canvas')
    canvas.width   = viewport.width
    canvas.height  = viewport.height
    const ctx      = canvas.getContext('2d')!

    await page.render({ canvasContext: ctx, viewport }).promise

    onProgress?.({
      stage: 'ocr',
      page: pageNum,
      totalPages,
      percent: Math.round(((pageNum - 0.5) / totalPages) * 80),
    })

    // OCR the rendered canvas
    const { data: { text } } = await worker.recognize(canvas)
    pageTexts.push(text)
  }

  await worker.terminate()

  onProgress?.({ stage: 'done', percent: 100 })
  return pageTexts.join('\n\n--- PAGE BREAK ---\n\n')
}
