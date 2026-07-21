import { parseNum, round2 } from './format'

export interface JvRow {
  dept: string
  acc: string
  desc: string
  debit: number
  credit: number
}

// Minimal structural shape of a Step-2 DetailRow — only the fields the JV builder
// reads. Kept local so this pure lib file has no dependency on the component layer.
interface Detail {
  Transaction?: string
  PayAmt?: string
  CommisAmt?: string
  TaxAmt?: string
  Total?: string
}

type Mapping = { dept?: string; acc?: string }

const leg = (cfg: Mapping, desc: string, debit: number, credit: number): JvRow => ({
  dept: cfg.dept || '',
  acc: cfg.acc || '',
  desc,
  debit,
  credit,
})

/**
 * Build the Step-3 journal-entry rows from extracted detail lines + accounting config.
 *
 * Consolidated (`consolidateDebit`, the default for all banks — see
 * `GROUP_DEBIT_BY_TRANSACTION` in constants/banks.ts): credit legs stay
 * one-per-payment-type; the debit side collapses to the **three canonical buckets**
 * (commission, tax, Bank Account) in fixed order, each summed across all lines and
 * **always present** — so a gateway invoice (net = 0) still shows a `0.00` Bank Account
 * row and every document type reviews with the same standard layout. Lossless: Σdebit /
 * Σcredit are unchanged, so the JV stays balanced. The zero legs are display-only —
 * `useOcrSubmission` drops them before posting so no empty GL lines reach Carmen.
 *
 * Per-line (`consolidateDebit: false`, preserved for future use): 1 credit
 * (PayAmt → payment-type account) + up to 3 debits (commission, tax, net) per
 * line; zero amounts are skipped.
 */
export function buildJvRows(
  details: Detail[],
  config: Record<string, unknown>,
  opts: { consolidateDebit?: boolean } = {}
): JvRow[] {
  const mappings = (config.mappings || {}) as Record<string, Mapping>
  const paymentAmount = (config.paymentAmount || {}) as Record<string, Mapping>

  if (opts.consolidateDebit) return consolidated(details, mappings, paymentAmount)

  const rows: JvRow[] = []
  const addRow = (cfg: Mapping, amount: number, desc: string, isDebit: boolean) => {
    if (!amount) return
    rows.push(isDebit ? leg(cfg, desc, amount, 0) : leg(cfg, desc, 0, amount))
  }
  details.forEach(detail => {
    const payType = detail.Transaction || 'UNKNOWN'
    addRow(paymentAmount[payType] || {}, parseNum(detail.PayAmt), payType, false)
    addRow(mappings.commission || {}, parseNum(detail.CommisAmt), 'Credit card commission', true)
    addRow(mappings.tax || {}, parseNum(detail.TaxAmt), 'Input Tax', true)
    addRow(mappings.net || {}, parseNum(detail.Total), 'Bank Account', true)
  })
  return rows
}

function consolidated(
  details: Detail[],
  mappings: Record<string, Mapping>,
  paymentAmount: Record<string, Mapping>
): JvRow[] {
  // Credit legs: one per payment-type detail line (unchanged), skip zero.
  const rows: JvRow[] = []
  details.forEach(detail => {
    const amt = parseNum(detail.PayAmt)
    if (!amt) return
    const payType = detail.Transaction || 'UNKNOWN'
    rows.push(leg(paymentAmount[payType] || {}, payType, 0, amt))
  })
  // Degenerate/empty document — no real credit legs, so emit nothing (mirrors the
  // per-line builder's "no data" outcome; keeps Submit disabled).
  if (rows.length === 0) return rows

  // Debit side: the three canonical buckets, summed, always present (standard layout).
  const sum = (k: keyof Detail) => round2(details.reduce((s, d) => s + parseNum(d[k]), 0))
  rows.push(leg(mappings.commission || {}, 'Credit card commission', sum('CommisAmt'), 0))
  rows.push(leg(mappings.tax || {}, 'Input Tax', sum('TaxAmt'), 0))
  rows.push(leg(mappings.net || {}, 'Bank Account', sum('Total'), 0))
  return rows
}
