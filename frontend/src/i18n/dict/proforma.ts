export const en = {
  // — Proforma doc UI controls (the printed body stays bilingual as-is) —
  'proforma.docNo': 'Document no.',
  'proforma.print': 'Print / Save PDF',
} as const

export const th: Record<keyof typeof en, string> = {
  // — Proforma doc UI controls —
  'proforma.docNo': 'เลขที่เอกสาร',
  'proforma.print': 'พิมพ์ / บันทึก PDF',
}
