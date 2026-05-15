import { parseNum, round2, fmt } from '../../lib/format'
import { getAvailableFields } from '../../constants/apInvoice'

/**
 * Pure computed validation — no state, no side effects.
 * Derives totals, diffs, and validation errors from lineItems and headerData.
 */
export function useAPValidation({ headerData, lineItems, fieldMappings, t }) {
  const isNumFld = f =>
    [
      'qty',
      'unitPrice',
      'discountPct',
      'discountAmt',
      'lineSubTotal',
      'taxPct',
      'taxAmt',
      'lineTotal',
    ].includes(f)

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

  const validationErrors = [
    isSubDiff && t?.subTotal,
    isDiscDiff && t?.discount,
    isTaxDiff && t?.tax,
    isGrandDiff && t?.grandTotal,
  ].filter(Boolean)

  const isValid = validationErrors.length === 0

  const availableFields = getAvailableFields(t || {})
  const activeCols = Object.keys(fieldMappings || {})
    .map(k => parseInt(k.replace('col', ''), 10))
    .filter(c => fieldMappings[`col${c}`] !== 'ignore' && fieldMappings[`col${c}`] !== 'category')

  /**
   * Adjusts the last line item's field to make the sum match the target.
   * Modifies lineItems array in-place (returns updated items).
   */
  const adjustField = (
    tgt,
    sumCur,
    itemKey,
    lineItems,
    adjustTotal = false,
    isDiscount = false
  ) => {
    if (!lineItems.length) return lineItems
    const diff = (Math.round(tgt * 100) - Math.round(sumCur * 100)) / 100
    if (diff === 0) return lineItems
    const items = [...lineItems]
    const last = items.length - 1
    items[last][itemKey] = fmt(
      (Math.round(round2(items[last][itemKey]) * 100) + Math.round(diff * 100)) / 100
    )
    if (adjustTotal) {
      const ltDiff = isDiscount ? -diff : diff
      items[last].lineTotal = fmt(
        (Math.round(round2(items[last].lineTotal) * 100) + Math.round(ltDiff * 100)) / 100
      )
    }
    return items
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
    validationErrors,
    isValid,
    availableFields,
    activeCols,
    adjustField,
  }
}
