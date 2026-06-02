import { parseNum, fmt } from './format'
import type { APLineItem } from '../hooks/ap-invoice/useAPExtraction'

// Tax-type labels used when a group has no profile code to name it by.
const TAX_TYPE_LABELS: Record<string, string> = {
  Include: 'Items (Include VAT)',
  Exclude: 'Items (Exclude VAT)',
  None: 'Items (No VAT)',
}

// The grouping identity of a line: None lines collapse to 'None'; taxable lines are keyed by their
// own profile code, falling back to the vendor default. Used both for the same-profile guard
// (Group by description) and the Group-all bucket key.
export function effectiveTaxProfile(item: APLineItem, vendorDefaultProfile: string): string {
  if ((item.taxType || 'Exclude') === 'None') return 'None'
  return item.taxProfileCode1 || vendorDefaultProfile || ''
}

// True when every item shares the same effective tax profile.
export function allSameProfile(items: APLineItem[], vendorDefaultProfile: string): boolean {
  if (items.length === 0) return true
  const first = effectiveTaxProfile(items[0], vendorDefaultProfile)
  return items.every(it => effectiveTaxProfile(it, vendorDefaultProfile) === first)
}

// Builds a single line that represents the sum of `items`, keeping the row internally consistent
// under the blurLineItem recalc rules:
//   afterDisc = qty * unitPrice - discountAmt
//   Exclude/None: lineSubTotal = afterDisc
//   Include:      lineTotal    = afterDisc
export function buildGroupedRow(items: APLineItem[], desc: string): APLineItem {
  const sum = (key: keyof APLineItem) => items.reduce((s, it) => s + parseNum(it[key] as string), 0)
  const sumLineTotal = sum('lineTotal')
  const sumLineSubTotal = sum('lineSubTotal')
  const sumTaxAmt = sum('taxAmt')
  const sumDiscount = sum('discountAmt')
  const taxType = items[0]?.taxType || 'Exclude'
  const taxPct = taxType === 'None' ? 0 : parseNum(items[0]?.taxPct as string) || 7
  const unitPrice =
    taxType === 'Include' ? sumLineTotal + sumDiscount : sumLineSubTotal + sumDiscount
  return {
    description: desc,
    category: '',
    qty: '1',
    unitPrice: fmt(unitPrice),
    discountPct: '0.00',
    discountAmt: fmt(sumDiscount),
    lineSubTotal: fmt(sumLineSubTotal),
    taxPct: fmt(taxPct),
    taxAmt: fmt(sumTaxAmt),
    taxType,
    lineTotal: fmt(sumLineTotal),
    taxProfileCode1: items[0]?.taxProfileCode1 || '',
    deptCode: '',
    accountCode: '',
  }
}

// A human label for an auto-generated group, named by its profile code when available.
function groupLabel(item: APLineItem, vendorDefaultProfile: string): string {
  const taxType = item.taxType || 'Exclude'
  if (taxType === 'None') return TAX_TYPE_LABELS.None
  const profile = item.taxProfileCode1 || vendorDefaultProfile
  return profile ? `Items (${profile})` : (TAX_TYPE_LABELS[taxType] ?? 'Items')
}

// Collapses `items` into one row per distinct (taxType, effectiveTaxProfile), preserving the order
// in which each bucket is first seen.
export function groupByTaxProfile(items: APLineItem[], vendorDefaultProfile: string): APLineItem[] {
  const groups = new Map<string, APLineItem[]>()
  for (const item of items) {
    const taxType = item.taxType || 'Exclude'
    const key = `${taxType}__${effectiveTaxProfile(item, vendorDefaultProfile)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return Array.from(groups.values()).map(grp =>
    buildGroupedRow(grp, groupLabel(grp[0], vendorDefaultProfile))
  )
}
