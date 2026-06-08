export const MAX_MULTI_IMAGES = 5

// Max image dimension before embedding — keeps payload small.
const MAX_DIMENSION = 1600

// Standard A4 in PDF points (1 pt = 1/72 inch). PyMuPDF renders at 200 DPI:
// 595 pt → ~1654 px wide, which is ideal for OCR. Using raw pixel values as
// PDF points (e.g. 1600 pt) would render at ~4444 px and blow up LLM context.
const A4_W = 595
const A4_H = 842

function resizeViaCanvas(img: HTMLImageElement, maxDim: number): Promise<Uint8Array<ArrayBuffer>> {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas not available'))
  ctx.drawImage(img, 0, 0, w, h)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('Canvas conversion failed'))
          return
        }
        blob.arrayBuffer().then(ab => resolve(new Uint8Array(ab as ArrayBuffer)))
      },
      'image/jpeg',
      0.88
    )
  })
}

async function toResizedJpeg(file: File): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resizeViaCanvas(img, MAX_DIMENSION).then(resolve).catch(reject)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

export async function imagesToPdf(files: File[]): Promise<File> {
  if (files.length > MAX_MULTI_IMAGES) {
    throw new Error(`Too many images — maximum ${MAX_MULTI_IMAGES}`)
  }

  const { PDFDocument } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.create()

  for (const file of files) {
    const bytes = await toResizedJpeg(file)
    const image = await pdfDoc.embedJpg(bytes)
    const { width: imgW, height: imgH } = image

    // Use A4 portrait or landscape depending on image orientation, then
    // fit the image inside with uniform scaling (letterbox).
    const landscape = imgW > imgH
    const pageW = landscape ? A4_H : A4_W
    const pageH = landscape ? A4_W : A4_H
    const scale = Math.min(pageW / imgW, pageH / imgH)
    const dw = imgW * scale
    const dh = imgH * scale
    const dx = (pageW - dw) / 2
    const dy = (pageH - dh) / 2

    const page = pdfDoc.addPage([pageW, pageH])
    page.drawImage(image, { x: dx, y: dy, width: dw, height: dh })
  }

  const pdfBytes = await pdfDoc.save()
  const name =
    files.length === 1
      ? files[0].name.replace(/\.[^.]+$/, '.pdf')
      : `merged_${files.length}_pages.pdf`
  // pdf-lib returns Uint8Array<ArrayBufferLike>; copy into a concrete ArrayBuffer so the File
  // constructor receives a valid BlobPart in TypeScript 6+ (which excludes SharedArrayBuffer).
  const buf = new Uint8Array(pdfBytes).buffer as ArrayBuffer
  return new File([buf], name, { type: 'application/pdf' })
}
