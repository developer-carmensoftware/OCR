import { parseNum, round2, fmt } from '../../lib/format'
import { getAvailableFields } from '../../constants/apInvoice'
import type { APLineItem } from './useAPExtraction'
import type { APInvoiceHeader } from '../../constants/apInvoice'

interface APValidationProps {
  headerData: APInvoiceHeader
  lineItems: APLineItem[]
  fieldMappings: Record<string, string>
  t?: Record<string, string>
}

// adjustField writes a single field onto the target row(s). reconcileRows re-derives the
// dependent field per taxType so every row stays internally consistent. Shared by the
// Adjust buttons and the header-tax blur — this is what stops the "whack-a-mole" where
// fixing one summary line opens a diff on another.
//   Include:      lineSubTotal = lineTotal − taxAmt   (lineTotal is the fixed gross)
//   Exclude/None: lineTotal    = lineSubTotal + taxAmt
export function reconcileRows(items: APLineItem[]): APLineItem[] {
  return items.map(item =>
    item.taxType === 'Include'
      ? { ...item, lineSubTotal: fmt(parseNum(item.lineTotal) - parseNum(item.taxAmt)) }
      : { ...item, lineTotal: fmt(parseNum(item.lineSubTotal) + parseNum(item.taxAmt)) }
  )
}

// The document over-specifies its totals: grand ≡ sub + tax, so three printed figures carry only
// two degrees of freedom. When they don't add up, the LLM misread one digit. Identify which figure
// is the outlier using the line-item sums (the detailed truth) as a tiebreaker, then recompute it
// from the identity. Returns null when the document is already self-consistent.
//   • sub corroborated by table, tax is not → tax  := grand − sub
//   • tax corroborated by table, sub is not → sub  := grand − tax
//   • both sub & tax corroborated           → grand := sub + tax
//   • both disagree (ambiguous)             → fix the field with the larger table error; on a tie
//                                             fix tax (sub & grand are the bold printed figures).
//
// `confident` flags the repairs safe to apply automatically (no user click): the outlier is NOT
// ambiguous (exactly one of sub/tax is corroborated by the table, or both are) AND the gap is small
// (≤ AUTO_FIX_MAX_GAP, i.e. a rounding / last-digit slip). Ambiguous or large gaps stay manual —
// the system can't be sure which printed figure is wrong, so it asks the user instead of silently
// rewriting a tax/total that goes to the ERP.
export const AUTO_FIX_MAX_GAP = 1.0 // baht; |sub + tax − grand| beyond this needs a human look
export interface DocRepair {
  field: 'subTotal' | 'taxAmount' | 'grandTotal'
  value: number
  confident: boolean
}
export function repairDocFigure(args: {
  tgtSubTotal: number
  tgtTax: number
  tgtGrand: number
  sumSub: number
  sumTax: number
}): DocRepair | null {
  const { tgtSubTotal, tgtTax, tgtGrand, sumSub, sumTax } = args
  const cents = (n: number) => Math.round(n * 100)
  const gapCents = cents(tgtSubTotal) + cents(tgtTax) - cents(tgtGrand)
  if (gapCents === 0) return null

  // Compare in integer cents so float noise (|100.01 − 100| ≠ |7.01 − 7|) never decides the outlier.
  const errSub = Math.abs(cents(tgtSubTotal) - cents(sumSub))
  const errTax = Math.abs(cents(tgtTax) - cents(sumTax))
  const subOk = errSub === 0
  const taxOk = errTax === 0
  const ambiguous = !subOk && !taxOk
  const smallGap = Math.abs(gapCents) <= Math.round(AUTO_FIX_MAX_GAP * 100)
  const confident = !ambiguous && smallGap

  if (subOk && !taxOk)
    return { field: 'taxAmount', value: round2(tgtGrand - tgtSubTotal), confident }
  if (taxOk && !subOk) return { field: 'subTotal', value: round2(tgtGrand - tgtTax), confident }
  if (subOk && taxOk) return { field: 'grandTotal', value: round2(tgtSubTotal + tgtTax), confident }

  // Ambiguous: both disagree with the table. Fix whichever is further off; tie → fix tax.
  return errSub > errTax
    ? { field: 'subTotal', value: round2(tgtGrand - tgtTax), confident }
    : { field: 'taxAmount', value: round2(tgtGrand - tgtSubTotal), confident }
}

export function useAPValidation({ headerData, lineItems, fieldMappings, t }: APValidationProps) {
  const sumLineSubTotal =
    lineItems.reduce((s, i) => s + Math.round(parseNum(i.lineSubTotal) * 100), 0) / 100
  const sumLineTotal =
    lineItems.reduce((s, i) => s + Math.round(parseNum(i.lineTotal) * 100), 0) / 100
  const sumDiscount =
    lineItems.reduce((s, i) => s + Math.round(parseNum(i.discountAmt) * 100), 0) / 100
  const sumTax = lineItems.reduce((s, i) => s + Math.round(parseNum(i.taxAmt) * 100), 0) / 100

  const tgtSubTotal = round2(headerData.subTotal)
  const tgtDiscount = round2(headerData.totalDiscount)
  const tgtTax = round2(headerData.taxAmount)
  const tgtGrand = round2(headerData.grandTotal)

  const isInclude = headerData.taxType === 'Include'
  const isSubDiff = sumLineSubTotal !== tgtSubTotal
  const isDiscDiff = sumDiscount !== tgtDiscount
  const isTaxDiff = sumTax !== tgtTax
  const calcGrandFromLines = sumLineTotal
  const isGrandDiff = calcGrandFromLines !== tgtGrand

  // The document's own From-Document figures don't add up (subTotal + tax ≠ grand). When this is
  // true a Grand diff can never be cleared by reconciling line items (grand ≡ Σsub + Σtax), so the
  // UI shows a warning instead of an Adjust button that would loop forever.
  const isDocInconsistent = tgtGrand > 0 && Math.abs(tgtSubTotal + tgtTax - tgtGrand) > 0.005

  const validationErrors: string[] = [
    isSubDiff && t?.subTotal,
    isDiscDiff && t?.discount,
    isTaxDiff && t?.tax,
    isGrandDiff && t?.grandTotal,
  ].filter((v): v is string => Boolean(v))

  const isValid = validationErrors.length === 0

  const availableFields = getAvailableFields(t || {})
  const activeCols = Object.keys(fieldMappings || {})
    .map(k => parseInt(k.replace('col', ''), 10))
    .filter(c => fieldMappings[`col${c}`] !== 'ignore' && fieldMappings[`col${c}`] !== 'category')
    .sort((a, b) => a - b)

  const adjustField = (
    tgt: unknown,
    sumCur: unknown,
    itemKey: string,
    items: APLineItem[]
  ): APLineItem[] => {
    if (!items.length) return items
    const diff = (Math.round(parseNum(tgt) * 100) - Math.round(parseNum(sumCur) * 100)) / 100
    if (diff === 0) return items
    const updated = [...items]

    // taxAmt with large diff (>1 THB): distribute proportionally across taxable
    // items by lineSubTotal so no single item gets an inflated tax amount.
    // Small diff (≤1 THB) stays on last taxable item (penny rounding).
    if (itemKey === 'taxAmt' && Math.abs(diff) > 1) {
      const taxableIdxs = updated
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => parseNum(item.taxPct) > 0)
      if (taxableIdxs.length > 0) {
        const totalSub = taxableIdxs.reduce((s, { item }) => s + parseNum(item.lineSubTotal), 0)
        let remaining = Math.round(diff * 100)
        taxableIdxs.forEach(({ item, i }, pos) => {
          const isLast = pos === taxableIdxs.length - 1
          // When totalSub === 0, fall back to equal distribution so the diff doesn't
          // dump entirely onto the last row.
          const share = isLast
            ? remaining
            : totalSub === 0
              ? Math.round((diff * 100) / taxableIdxs.length)
              : Math.round(diff * (parseNum(item.lineSubTotal) / totalSub) * 100)
          remaining -= share
          const shareDec = share / 100
          updated[i] = {
            ...updated[i],
            taxAmt: fmt(
              (Math.round(round2(updated[i].taxAmt) * 100) + Math.round(shareDec * 100)) / 100
            ),
          }
        })
        return updated
      }
    }

    // Default: absorb diff into last taxable item for taxAmt (small diff / fallback),
    // or last item for other fields.
    let targetIdx = updated.length - 1
    if (itemKey === 'taxAmt') {
      const taxables = [...updated]
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => parseNum(item.taxPct) > 0)
      const lastTaxable = taxables.length ? taxables[taxables.length - 1] : undefined
      if (lastTaxable) targetIdx = lastTaxable.i
    }

    // Writes only `itemKey`. The caller (useAPInvoice.adjustField / blurHeader) runs a
    // per-row reconcile afterwards to re-derive the dependent field by taxType, so the
    // touched row stays internally consistent (lineSubTotal + taxAmt == lineTotal).
    updated[targetIdx] = {
      ...updated[targetIdx],
      [itemKey]: fmt(
        (Math.round(round2(updated[targetIdx][itemKey]) * 100) + Math.round(diff * 100)) / 100
      ),
    }
    return updated
  }

  return {
    sumLineSubTotal,
    sumLineTotal,
    sumDiscount,
    sumTax,
    tgtSubTotal,
    tgtDiscount,
    tgtTax,
    tgtGrand,
    isInclude,
    isSubDiff,
    isDiscDiff,
    isTaxDiff,
    calcGrandFromLines,
    isGrandDiff,
    isDocInconsistent,
    validationErrors,
    isValid,
    availableFields,
    activeCols,
    adjustField,
  }
}
