import { parseNum } from './format'
import { parseDateToISO } from './date'
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
  const taxPeriod = parts.length === 3 ? `${parts[1]}/${parts[2]}` : ''

  const detail = lineItems.map(item => {
    const netAmt = parseNum(item.lineSubTotal)
    const taxAmt = parseNum(item.taxAmt)
    const total = parseNum(item.lineTotal)
    // When the line has no VAT (taxAmt === 0), keep rate at 0 so Carmen does not
    // recompute tax from the rate. The || 7 default only applies to non-zero-tax lines.
    const taxRate = taxAmt === 0 ? 0 : parseNum(item.taxPct)
    // None / non-VAT line: no profile, no rate. Otherwise use the line's own profile code.
    const resolvedProfile = item.taxType === 'None' ? null : item.taxProfileCode1 || null
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
    const grossPrice = parseNum(item.unitPrice)
    const discAmt = parseNum(item.discountAmt)
    const grossLine = grossPrice * qty
    const netPriceRaw = grossLine > 0 ? (grossLine - discAmt) / qty : grossPrice
    const netPrice = parseFloat(Math.max(0, netPriceRaw).toFixed(2))

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
      InvdT1Dr: systemVendor.vat1DrAccCode || '',
      InvdTaxT1:
        taxAmt === 0 || item.taxType === 'None'
          ? 'None'
          : item.taxType === 'Include'
            ? 'Include'
            : 'Add',
      InvdTaxR1: taxRate.toFixed(2),
      DimList: {},
      LastModified: now,
      InvdBTaxCr1DeptCode: systemVendor.crDeptCode || '',
      InvdT1DrDeptCode: systemVendor.vat1DrDeptCode || '',
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
