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

// Returns a copy of `item` whose net anchor (unitPrice, or lineSubTotal for grouped rows) is shifted
// so that after recalcRow the targeted amount moves by `diff` — `kind:'sub'` targets the row's
// lineSubTotal, `kind:'grand'` targets its lineTotal. Used by the Adjust buttons so a row stays
// internally consistent (sub + tax = total) while its From-Table contribution lands on the
// document value. The shift is expressed on `afterDisc` then mapped onto whichever anchor exists.
export function nudgeAnchorForTarget(
  item: APLineItem,
  kind: 'sub' | 'grand',
  diff: number
): APLineItem {
  const taxType = (item.taxType || 'Exclude') as APTaxType
  const r = taxType === 'None' ? 0 : Math.max(0, parseNum(item.taxPct))
  const factor = 1 + r / 100

  // How much `afterDisc` (the net-after-discount anchor) must move for the targeted amount to
  // change by `diff`, given how recalcRow maps afterDisc → sub/total per tax type.
  let deltaAfterDisc: number
  if (taxType === 'None') {
    deltaAfterDisc = diff // sub === grand === afterDisc
  } else if (taxType === 'Exclude') {
    deltaAfterDisc = kind === 'sub' ? diff : diff / factor // grand = afterDisc * factor
  } else {
    deltaAfterDisc = kind === 'sub' ? diff * factor : diff // sub = afterDisc / factor; grand = afterDisc
  }

  const qty = parseNum(item.qty) || 1
  const unitPrice = parseNum(item.unitPrice)
  if (unitPrice > 0) {
    return recalcRow({ ...item, unitPrice: fmt(unitPrice + deltaAfterDisc / qty) })
  }
  // Grouped / no-unitPrice row: recalcRow anchors on lineSubTotal + discountAmt.
  return recalcRow({ ...item, lineSubTotal: fmt(parseNum(item.lineSubTotal) + deltaAfterDisc) })
}
