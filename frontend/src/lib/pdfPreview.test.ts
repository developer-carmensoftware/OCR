import { describe, it, expect } from 'vitest'
import { PDFDocument, PDFName } from 'pdf-lib'
import { stripAutoOpen } from './pdfPreview'

describe('stripAutoOpen', () => {
  it('removes the auto-open action that triggers the print dialog', async () => {
    // Build a PDF that auto-prints on open (catalog /OpenAction → /Named /Print).
    const doc = await PDFDocument.create()
    doc.addPage()
    const action = doc.context.obj({ S: 'Named', N: 'Print' })
    doc.catalog.set(PDFName.of('OpenAction'), doc.context.register(action))
    const withAction = await doc.save()

    // Sanity: it's actually there before stripping.
    const before = await PDFDocument.load(withAction)
    expect(before.catalog.get(PDFName.of('OpenAction'))).toBeDefined()

    const cleaned = await stripAutoOpen(withAction)
    const after = await PDFDocument.load(cleaned)
    expect(after.catalog.get(PDFName.of('OpenAction'))).toBeUndefined()
    expect(after.getPageCount()).toBe(1) // page content survives
  })
})
