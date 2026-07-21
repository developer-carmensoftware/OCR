import { parseNum } from './format'
import { parseDateToISO, normalizeYearToCE } from './date'
import type { APLineItem } from '../types/ap'
import type { APInvoiceHeader } from '../constants/apInvoice'
import type { TaxProfileItem } from './api/carmen'
import type { Vendor } from '../hooks/ap-invoice/useAPVendor'

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export function buildInvoicePayload(
  headerData: APInvoiceHeader,
  lineItems: APLineItem[],
  systemVendor: Vendor,
  taxProfiles: TaxProfileItem[]
): Record<string, unknown> {
  const now = new Date().toISOString()
  const invDate = parseDateToISO(headerData.documentDate)
  const creditTerm = systemVendor.term ?? 0
  const dueDate = creditTerm > 0 ? addDays(invDate, creditTerm) : invDate
  const parts = (headerData.documentDate || '').split('/')
  const taxPeriod = parts.length === 3 ? `${parts[1]}/${normalizeYearToCE(parts[2])}` : ''

  const detail = lineItems.map(item => {
    const netAmt = parseNum(item.lineSubTotal)
    const taxAmt = parseNum(item.taxAmt)
    const total = parseNum(item.lineTotal)
    // A line carries VAT only when it has a non-zero tax amount AND is not explicitly None.
    // For a no-VAT line the ENTIRE tax-1 field set must read "no tax": profile, rate, and the
    // tax-Dr account/dept are all cleared below. The tax profile must follow the LINE, not the
    // vendor — if we leave the vendor's tax-Dr account populated on a NONE line, Carmen
    // back-fills the vendor's default tax profile (e.g. VAT07) onto a line the user marked NONE.
    const noVat = taxAmt === 0 || item.taxType === 'None'
    // When the line has no VAT, keep rate at 0 so Carmen does not recompute tax from the rate.
    // The || 7 default only applies to non-zero-tax lines.
    const taxRate = noVat ? 0 : parseNum(item.taxPct)
    // No profile on a no-VAT line. If Carmen exposes an explicit NONE profile use it so Carmen
    // does not back-fill the vendor's default (e.g. VAT07) onto the display; otherwise null.
    const noneProfileCode = taxProfiles.find(p => p.code === 'NONE')?.code ?? null
    const resolvedProfile = noVat ? noneProfileCode : item.taxProfileCode1 || null
    const profileRate = resolvedProfile
      ? (taxProfiles.find(p => p.code === resolvedProfile)?.rate ?? null)
      : null
    // When our explicit rate disagrees with the resolved profile's rate (rate-match
    // fallback to vendor, or a manual Tax% override), force Carmen to honour the rate +
    // tax amount WE send instead of recomputing from the profile. Also overwrite when a
    // taxable line resolved no profile rate at all.
    const tax1Overwrite =
      taxAmt > 0 && (profileRate == null || Math.abs(profileRate - taxRate) > 0.01)
    const qty = parseNum(item.qty) || 1
    // Carmen has no discount field on the line, so the unit price it stores must already
    // be net. Anchor it on the line AMOUNT rather than recomputing it from unitPrice and
    // discountAmt: those are display fields, and when they disagreed with lineSubTotal
    // Carmen's AP screen showed a Price/Unit that did not multiply out to its own Net
    // Amount (6 x 781.00 against a Net of 4,379.44), which is unusable for anyone
    // checking the figures by hand.
    //
    // Include lines carry VAT in the price column, so they anchor on the VAT-inclusive
    // total; Add/None lines anchor on the ex-VAT net. Negative rows (a "-190 DISCOUNT"
    // line, a deposit row) pass straight through — they must post a negative price, not
    // the 0.00 the old clamp produced.
    const priceAnchor = item.taxType === 'Include' ? total : netAmt
    const netPrice = parseFloat((priceAnchor / qty).toFixed(2))

    return {
      InvhSeq: -1,
      InvdSeq: -1,
      InvdDesc: item.description || '',
      InvdQty: qty,
      UnitCode: 'UNIT',
      InvdPrice: netPrice.toFixed(2),
      InvdTaxA1: taxAmt.toFixed(2),
      InvdTaxC1: taxAmt.toFixed(2),
      NetAmt: netAmt.toFixed(2),
      NetBaseAmt: netAmt.toFixed(2),
      UnPaid: total.toFixed(2),
      TotalPrice: total.toFixed(2),
      DeptCode: item.deptCode || '',
      InvdBTaxCr1: systemVendor.vatCrAccCode || '',
      InvdBTaxDr: item.accountCode || '',
      // Tax-1 Dr account/dept belong to the VAT entry — omit them on a no-VAT line so Carmen
      // produces no tax line and does not attach the vendor's default tax profile.
      InvdT1Dr: noVat ? '' : systemVendor.vat1DrAccCode || '',
      InvdTaxT1: noVat ? 'None' : item.taxType === 'Include' ? 'Include' : 'Add',
      InvdTaxR1: taxRate.toFixed(2),
      DimList: {},
      LastModified: now,
      InvdBTaxCr1DeptCode: systemVendor.crDeptCode || '',
      InvdT1DrDeptCode: noVat ? '' : systemVendor.vat1DrDeptCode || '',
      TaxProfileCode1: resolvedProfile,
      Tax1Overwrite: tax1Overwrite,
    }
  })

  return {
    VnCode: systemVendor.code || '',
    InvhDate: now,
    InvhDesc: headerData.invhDesc || '',
    InvhSource: 'AAPI',
    InvhInvNo: headerData.documentNumber || '',
    InvhInvDate: invDate,
    InvhDueDate: dueDate,
    InvhCredit: creditTerm,
    CurCode: 'THB',
    CurRate: 1,
    InvhTInvNo: headerData.documentNumber || '',
    InvhTInvDt: invDate,
    TaxPeriod: taxPeriod,
    TaxStatus: 'Pending',
    InvhTotalAmt: parseNum(headerData.grandTotal),
    InvWht: {},
    DimHList: {},
    Detail: detail,
    InvhStatus: '',
    VoidRemark: '',
  }
}

const _CARMEN_FIELD_LABELS: Record<string, string> = {
  InvhInvNo: 'Invoice Number',
  VnCode: 'Vendor Code',
  InvhDate: 'Invoice Date',
  InvdSeq: 'Invoice Line',
}

export function formatCarmenError(msg: string): string {
  return (msg || '').replace(
    /\b(InvhInvNo|VnCode|InvhDate|InvdSeq)\b/g,
    m => _CARMEN_FIELD_LABELS[m] || m
  )
}

export function parseCarmenDupError(msg: string): { invNo: string; vnCode: string } | null {
  const m = (msg || '').match(/InvhInvNo.*?\[([^\],]+),([^\]]+)\]/)
  if (!m) return null
  return { invNo: m[1].trim(), vnCode: m[2].trim() }
}
