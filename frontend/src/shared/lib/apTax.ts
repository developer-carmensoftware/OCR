import { parseNum, fmt, round2 } from './format'
import type { APLineItem } from '@/shared/types/ap'
import type { TaxProfileItem } from '@/shared/api/carmen'

export type APTaxType = 'Include' | 'Exclude' | 'None'

// Resolve a line's Tax Profile code from its rate. Among profiles that share the rate, prefer
// the vendor's default profile (Carmen profiles carry only a rate — same-rate profiles are
// otherwise indistinguishable, so the bare first-match picks an arbitrary GL/tax-report bucket).
// Returns '' when no profile defines the rate — the caller keeps the line's rate and surfaces the
// unmatched-rate warning rather than rewriting a valid rate to the vendor default.
export function resolveTaxProfileForRate(
  rate: number,
  taxProfiles: TaxProfileItem[],
  vendorDefaultCode?: string
): string {
  if (vendorDefaultCode) {
    const vr = taxProfiles.find(p => p.code === vendorDefaultCode)?.rate
    if (vr != null && Math.abs(vr - rate) < 0.01) return vendorDefaultCode
  }
  return taxProfiles.find(p => p.rate != null && Math.abs(p.rate - rate) < 0.01)?.code || ''
}

// Single source of truth for the per-row Include / Exclude / None tax formula. Derives
// lineSubTotal / taxAmt / lineTotal from qty, unitPrice, discount, the row's taxType and taxPct.
// taxPct is clamped >= 0 and forced to 0 for None. When unitPrice is missing (e.g. grouped rows)
// the net anchor falls back to lineSubTotal + discountAmt.
//
// Agrees with the Python `_compute_line_totals` in
// backend/app/services/ap_invoice_postprocess_service.py — not by sharing code but because
// `_resolve_line_discount` normalises discountAmt to satisfy
// `qty * unitPrice - discountAmt == afterDisc`, which is exactly the anchor used here.
// The two formulas are otherwise independent, so `test_discount_parity` in apTax.test.ts
// is what actually holds them together: it failed silently for per-unit discount columns
// before that invariant existed, and the first edit to such a row moved its amount.
export function recalcRow(item: APLineItem): APLineItem {
  const qty = parseNum(item.qty) || 1
  const unitPrice = parseNum(item.unitPrice)
  const discountAmt = parseNum(item.discountAmt)
  const taxType = (item.taxType || 'Exclude') as APTaxType
  const taxPct = taxType === 'None' ? 0 : Math.max(0, parseNum(item.taxPct))

  // `!== 0`, not `> 0`: a negative row (a "-190 DISCOUNT" line, a deposit row) has a real
  // price and must recalculate from it. Under `> 0` those rows fell into the grouped-row
  // fallback, so editing their unitPrice did nothing at all.
  const afterDisc =
    unitPrice !== 0
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

  // Re-derive the % from the amount so the discount column stops lying after a qty,
  // unitPrice or discountAmt edit. Left stale it was worse than absent: blurring the %
  // field re-applied the old percentage and moved the row's amount with it.
  const gross = round2(qty * unitPrice)
  const discountPct = gross > 0 ? round2((discountAmt / gross) * 100) : parseNum(item.discountPct)

  return {
    ...item,
    taxType,
    taxPct: fmt(taxPct),
    discountPct: fmt(discountPct),
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

/**
 * The tax-profile auto-match, as a pure pass over the rows: each untouched taxable line
 * gets the profile for its rate (the vendor's own among same-rate ones), a None line has
 * its profile cleared. Returns `prev` itself when nothing changed, which is what stops the
 * effect that calls it from looping. See useAPInvoice for when it runs.
 */
export function matchTaxProfiles(
  prev: APLineItem[],
  taxProfiles: TaxProfileItem[],
  vendorTaxProfile: string | undefined
): APLineItem[] {
  if (!prev.length) return prev
  let changed = false
  const next = prev.map(it => {
    if (it._taxProfileTouched) return it
    if (it.taxType === 'None') {
      if (it.taxProfileCode1 !== '') {
        changed = true
        return { ...it, taxProfileCode1: '' }
      }
      return it
    }
    const rate = parseNum(it.taxPct)
    const desired = resolveTaxProfileForRate(rate, taxProfiles, vendorTaxProfile)
    if (it.taxProfileCode1 !== desired) {
      changed = true
      return { ...it, taxProfileCode1: desired }
    }
    return it
  })
  return changed ? next : prev
}

/**
 * One line's tax fields after the user changed one of them — the interlock behind every
 * tax <select> in the AP review table. See useAPInvoice's applyLineTax for the rules.
 */
export function applyTaxPatch(
  it: APLineItem,
  patch: { taxType?: 'Include' | 'Exclude' | 'None'; taxProfileCode1?: string; taxPct?: string },
  taxProfiles: TaxProfileItem[],
  headerTaxType: string | undefined
): APLineItem {
  const rateOf = (code: string) => taxProfiles.find(p => p.code === code)?.rate ?? null
  const codeForRate = (rate: number) =>
    taxProfiles.find(p => p.rate != null && Math.abs(p.rate - rate) < 0.01)?.code || ''

  const merged = { ...it, ...patch }
  const prevType = (it.taxType || 'Exclude') as 'Include' | 'Exclude' | 'None'

  // Derive the effective taxType, honouring profile-driven None.
  let taxType = (merged.taxType || 'Exclude') as 'Include' | 'Exclude' | 'None'
  if (patch.taxProfileCode1 !== undefined) {
    if (patch.taxProfileCode1 === 'NONE') {
      taxType = 'None'
      merged.taxProfileCode1 = ''
    } else if (patch.taxProfileCode1 === '') {
      if (taxType === 'None') {
        // Restore to the document-level tax type when selecting "—" on a None line
        taxType = headerTaxType === 'Include' ? 'Include' : 'Exclude'
      }
      merged.taxProfileCode1 = ''
    } else if (taxType === 'None') {
      // Restore to the document-level tax type (Include/Exclude) when un-Noning a line
      // by picking a profile; fall back to Exclude if the header is also None/missing.
      taxType = headerTaxType === 'Include' ? 'Include' : 'Exclude'
    }
  }

  if (taxType === 'None') {
    return recalcRow({ ...merged, taxType: 'None', taxProfileCode1: '', taxPct: '0' })
  }

  // Pure Include ↔ Exclude toggle (only taxType changed, neither side None): pin the net
  // subtotal and re-derive tax/total from the rate. recalcRow re-anchors on unitPrice, whose
  // gross/net meaning differs by tax type, so going through it here would make the line jump
  // to the stored unitPrice's gross — pinning the subtotal keeps the toggle non-destructive.
  const isToggle =
    patch.taxType !== undefined &&
    patch.taxProfileCode1 === undefined &&
    patch.taxPct === undefined &&
    prevType !== 'None'
  if (isToggle) {
    const r = Math.max(0, parseNum(merged.taxPct))
    const sub = round2(merged.lineSubTotal)
    const taxAmt = round2((sub * r) / 100)
    return {
      ...merged,
      taxType,
      lineSubTotal: fmt(sub),
      taxAmt: fmt(taxAmt),
      lineTotal: fmt(sub + taxAmt),
    }
  }

  let code = merged.taxProfileCode1 || ''
  let rate = parseNum(merged.taxPct)
  if (patch.taxProfileCode1) {
    const r = rateOf(code) // profile drives the rate
    if (r != null) rate = r
  } else if (patch.taxPct !== undefined) {
    // Rate drives the profile. When no profile defines this rate, blank the profile (keep the
    // rate) rather than holding a stale code — the line stays taxable and the UI warns.
    if (rateOf(code) !== rate) code = codeForRate(rate)
  }
  // No `!code` fallback: picking "—" (or un-Noning with no profile) leaves the line taxable
  // with no specific profile and its current rate — we never silently inject the vendor
  // default (matches auto-match / grouping / submission, which also dropped that fallback).

  return recalcRow({ ...merged, taxType, taxProfileCode1: code, taxPct: String(rate) })
}
