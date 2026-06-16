// Build a PDF containing ONLY the given pages (0-based) from a source PDF file,
// preserving native vector/text content (no rasterisation), and return a blob URL
// suitable for an <iframe> preview. Used so the document preview shows just the
// pages the user picked for extraction — zoomable and readable, unlike the low-res
// page thumbnails it replaces.
//
// Caller owns the returned URL and must URL.revokeObjectURL() it when replacing.
// Throws if the PDF cannot be parsed (e.g. a user-password-encrypted file) — the
// caller should fall back to previewing the whole document.
export async function selectedPagesToPdfUrl(file: File, pages: number[]): Promise<string> {
  const { PDFDocument } = await import('pdf-lib')
  const srcBytes = await file.arrayBuffer()
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true })

  const total = src.getPageCount()
  // De-dup + keep order + drop out-of-range; empty selection → all pages.
  const seen = new Set<number>()
  const wanted: number[] = []
  for (const p of pages) {
    if (p >= 0 && p < total && !seen.has(p)) {
      seen.add(p)
      wanted.push(p)
    }
  }
  const indices = wanted.length ? wanted : src.getPageIndices()

  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, indices)
  copied.forEach(page => out.addPage(page))

  const bytes = await out.save()
  const buf = new Uint8Array(bytes).buffer as ArrayBuffer
  const blob = new Blob([buf], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}
