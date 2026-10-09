import type { PmsRow } from '@/features/credit-card/api/pmsReview'

/**
 * The JV a PMS day makes, recomputed in the browser as the reviewer changes a new code's
 * account. The server's `services/pms/day.py` is the authority — Approve rebuilds the JV
 * there and posts that — so this only has to agree with it for the screen to show what
 * will post. Integer cents, so a column of decimals adds up exactly.
 */

const LEDGERS = new Set(['Guest Ledger', 'Deposit Ledger'])

/** The mapping key a row posts through: the code, never its description. */
export function keyOf(r: PmsRow): string {
  if (LEDGERS.has(r.code)) return `Ledger|${r.code}`
  if (r.desc.endsWith(' - VAT')) return 'VAT|*'
  if (r.desc.endsWith(' - SERVICE')) return 'SVC|*'
  return `${r.type}|${r.code}`
}

export const toCents = (amount: string): number => Math.round(Number(amount) * 100)

/** + credit, − debit; Guest Ledger posts with its sign reversed. */
export const signedCents = (r: PmsRow): number =>
  toCents(r.amount) * (r.code === 'Guest Ledger' ? -1 : 1)

export interface JvLine {
  dept: string
  acc: string
  cents: number
}

/** One line per (dept, account), debits first, then credits, each by account. A row whose
 *  key has no account is left out — which is why such a day cannot be approved. */
export function jvLines(
  rows: PmsRow[],
  accounts: Record<string, { dept?: string | null; acc?: string | null }>
): JvLine[] {
  const agg = new Map<string, JvLine>()
  for (const r of rows) {
    const a = accounts[keyOf(r)]
    if (!a?.dept || !a?.acc) continue
    const k = `${a.dept}|${a.acc}`
    const line = agg.get(k) ?? { dept: a.dept, acc: a.acc, cents: 0 }
    line.cents += signedCents(r)
    agg.set(k, line)
  }
  return [...agg.values()]
    .filter(l => l.cents !== 0)
    .sort((a, b) => Number(a.cents > 0) - Number(b.cents > 0) || a.acc.localeCompare(b.acc))
}

/** 1234567 → "12,345.67"; the sign is the column's job, never the number's. */
export const fmtCents = (cents: number): string =>
  (Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

/** "-2542.94" → "2,542.94", for a decimal string the server sent. */
export const fmtAmount = (amount: string): string => fmtCents(toCents(amount))
