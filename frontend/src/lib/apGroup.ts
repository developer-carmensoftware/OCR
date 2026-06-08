import { parseNum, fmt } from './format'
import type { APLineItem } from '../hooks/ap-invoice/useAPExtraction'

// The grouping identity of a line: None lines collapse to 'None'; taxable lines are keyed by their
// own profile code. Used as the bucket key in groupSelected.
export function effectiveTaxProfile(item: APLineItem | undefined): string {
  if (!item) return ''
  if ((item.taxType || 'Exclude') === 'None') return 'None'
  return item.taxProfileCode1 || ''
}

// Builds a single line that represents the sum of `items`, keeping the row internally consistent
// under the blurLineItem recalc rules:
//   afterDisc = qty * unitPrice - discountAmt
//   Exclude/None: lineSubTotal = afterDisc
//   Include:      lineTotal    = afterDisc
// _taxProfileTouched is stamped so the auto-match effect never overwrites the grouped row's profile.
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
    _taxProfileTouched: '1',
  }
}

// Groups `selected` into one row per distinct (taxType, effectiveTaxProfile), all sharing `desc`.
// Preserves first-seen order of profiles. Returns {row, bucket} pairs for the caller to build
// groupSources. Mixed-profile selections naturally produce multiple rows, each with the same name.
export function groupSelected(
  selected: APLineItem[],
  desc: string
): { row: APLineItem; bucket: APLineItem[] }[] {
  const groups = new Map<string, APLineItem[]>()
  for (const item of selected) {
    const taxType = item.taxType || 'Exclude'
    const key = `${taxType}__${effectiveTaxProfile(item)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return Array.from(groups.values()).map(bucket => ({
    row: buildGroupedRow(bucket, desc),
    bucket,
  }))
}
