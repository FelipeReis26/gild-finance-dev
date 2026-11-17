// Reads the text of a PDF on the device (pdf.js) and rebuilds it as lines,
// top to bottom, the way the page reads. Used for Avant statements, which
// only come as PDFs. pdf.js is loaded only when a PDF is actually opened.

// pdf.js gives text in pieces with positions; pieces on the same baseline
// (within 2pt) belong to one line, read left to right.
export function linesFromTextItems(pages) {
  const out = []
  for (const items of pages) {
    const rows = []
    for (const it of items) {
      const str = it.str
      if (!str || !str.trim()) continue
      const x = it.transform[4]
      const y = it.transform[5]
      let row = rows.find((r) => Math.abs(r.y - y) <= 2)
      if (!row) rows.push((row = { y, parts: [] }))
      row.parts.push({ x, str, w: it.width || 0 })
    }
    rows.sort((a, b) => b.y - a.y)
    for (const r of rows) {
      r.parts.sort((a, b) => a.x - b.x)
      let line = ''
      let end = null
      for (const p of r.parts) {
        // a visible gap between pieces is a space; touching pieces join
        if (line && (end == null || p.x - end > 1)) line += ' '
        line += p.str
        end = p.x + p.w
      }
      line = line.replace(/\s+/g, ' ').trim()
      if (line) out.push(line)
    }
  }
  return out
}

// In the iPhone app the text comes from iOS's own PDFKit (the PdfText plugin
// in ios/App/App/AppDelegate.swift); in a browser, from pdf.js below.
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

async function nativePdfLines(data) {
  const { registerPlugin } = await import('@capacitor/core')
  const PdfText = registerPlugin('PdfText')
  const { pages } = await PdfText.extract({ data: toBase64(data) })
  return linesFromTextItems(
    (pages || []).map((items) => (items || []).map((it) => ({ str: it.str, transform: [1, 0, 0, 1, it.x, it.y], width: it.w })))
  )
}

export async function pdfLines(data) {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) return nativePdfLines(data)
  // The legacy build: the same pdf.js compiled for older browsers, with
  // stand-ins for JavaScript features iOS 26's web view doesn't have yet (the
  // modern build failed there with "undefined is not a function").
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Run pdf.js on the page itself, not in a Web Worker. The iPhone app serves
  // its files from its own capacitor:// address, and a worker script won't
  // start from there; a statement is a page or two, so it's instant anyway.
  // With the worker's code already loaded as an ordinary module, pdf.js uses
  // it in place ("fake worker") and never tries to start a real one.
  if (!globalThis.pdfjsWorker?.WorkerMessageHandler) {
    globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs')
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items)
  }
  await doc.destroy()
  return linesFromTextItems(pages)
}
