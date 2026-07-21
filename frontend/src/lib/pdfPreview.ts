// The browser's native PDF viewer honours a PDF's embedded auto-open actions
// (catalog /OpenAction, e.g. a `/Named /Print`), so previewing such a file in an
// <iframe> pops the print dialog on its own. We can't re-sandbox the iframe (Edge
// then refuses to render the PDF at all — see DocumentPreview), so instead we strip
// those actions from a throwaway copy before handing the blob to the viewer.

/** Remove document-level auto-open / auto-print actions. Pure; returns new bytes. */
export async function stripAutoOpen(bytes: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, PDFName } = await import('pdf-lib')
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  doc.catalog.delete(PDFName.of('OpenAction')) // fires on open (the auto-print trigger)
  doc.catalog.delete(PDFName.of('AA')) // additional actions (WillPrint/WillClose/…)
  return doc.save()
}

/**
 * Blob URL for previewing a PDF file with its auto-open actions stripped.
 * Falls back to the raw file URL if the PDF can't be parsed — a possible stray
 * print prompt beats no preview at all.
 */
export async function sanitizedPdfUrl(file: File): Promise<string> {
  try {
    const clean = await stripAutoOpen(await file.arrayBuffer())
    const buf = new Uint8Array(clean).buffer as ArrayBuffer
    return URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
  } catch {
    return URL.createObjectURL(file)
  }
}
