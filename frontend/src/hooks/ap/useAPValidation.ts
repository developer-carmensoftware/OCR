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

  const adjustField = (
    tgt: unknown,
    sumCur: unknown,
    itemKey: string,
    items: APLineItem[],
    adjustTotal = false,
    isDiscount = false
  ): APLineItem[] => {
    if (!items.length) return items
    const diff = (Math.round(parseNum(tgt) * 100) - Math.round(parseNum(sumCur) * 100)) / 100
    if (diff === 0) return items
    const updated = [...items]
    const last = updated.length - 1
    updated[last] = {
      ...updated[last],
      [itemKey]: fmt(
        (Math.round(round2(updated[last][itemKey]) * 100) + Math.round(diff * 100)) / 100
      ),
    }
    if (adjustTotal) {
      const ltDiff = isDiscount ? -diff : diff
      updated[last] = {
        ...updated[last],
        lineTotal: fmt(
          (Math.round(round2(updated[last].lineTotal) * 100) + Math.round(ltDiff * 100)) / 100
        ),
      }
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
    validationErrors,
    isValid,
    availableFields,
    activeCols,
    adjustField,
  }
}
