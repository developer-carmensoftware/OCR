import { parseNum, fmt, round2 } from './format'
import type { APLineItem } from '../hooks/ap-invoice/useAPExtraction'

export type APTaxType = 'Include' | 'Exclude' | 'None'

// Single source of truth for the per-row Include / Exclude / None tax formula. Derives
// lineSubTotal / taxAmt / lineTotal from qty, unitPrice, discount, the row's taxType and taxPct.
// taxPct is clamped >= 0 and forced to 0 for None. When unitPrice is missing (e.g. grouped rows)
// the net anchor falls back to lineSubTotal + discountAmt.
//
// Mirrors the Python `_compute_line_totals` in
// backend/app/services/ap_invoice_postprocess_service.py — keep the two in sync.
export function recalcRow(item: APLineItem): APLineItem {
  const qty = parseNum(item.qty) || 1
  const unitPrice = parseNum(item.unitPrice)
  const discountAmt = parseNum(item.discountAmt)
  const taxType = (item.taxType || 'Exclude') as APTaxType
  const taxPct = taxType === 'None' ? 0 : Math.max(0, parseNum(item.taxPct))

  const afterDisc =
    unitPrice > 0
      ? round2(qty * unitPrice - discountAmt)
      : round2(parseNum(item.lineSubTotal) + discountAmt)

  let lineSubTotal: number, taxAmt: number, lineTotal: number
  if (taxType === 'None') {
    lineSubTotal = afterDisc
    taxAmt = 0
    lineTotal = afterDisc
  } else if (taxType === 'Include') {
    lineSubTotal = round2((afterDisc * 100) / (100 + taxPct))
    taxAmt = round2(afterDisc - lineSubTotal)
    lineTotal = afterDisc
  } else {
    lineSubTotal = afterDisc
    taxAmt = round2((lineSubTotal * taxPct) / 100)
    lineTotal = round2(lineSubTotal + taxAmt)
  }

  return {
    ...item,
    taxType,
    taxPct: fmt(taxPct),
    lineSubTotal: fmt(lineSubTotal),
    taxAmt: fmt(taxAmt),
    lineTotal: fmt(lineTotal),
  }
}

// Keeps every row's lineTotal == lineSubTotal + taxAmt (uniform across tax types). Used by the
// Adjust buttons after a pin-based plug onto lineSubTotal or taxAmt: the targeted amount field is
// written directly and the total simply follows, so an adjustment never re-derives a sibling field
// from the rate (which is what made the summary diffs fight each other and need repeated clicks).
export function syncLineTotals(items: APLineItem[]): APLineItem[] {
  return items.map(i => ({
    ...i,
    lineTotal: fmt(round2(i.lineSubTotal) + round2(i.taxAmt)),
  }))
}
