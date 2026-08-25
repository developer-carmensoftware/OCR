import { parseNum, round2 } from './format'
import { codeToSource, descriptionForBank } from './bankTransforms'
import { normalizeYearToCE } from './date'

/** The four accounting-config fields a JV header needs, already normalised. */
export interface GljvConfig {
  filePrefix?: string
  fileSource?: string
  description?: string
  bankDescriptions?: Record<string, string>
}

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

/**
 * JV rows + accounting config → the exact Carmen `gljv` body the wizard posts.
 *
 * Server-side twin: `build_gljv_payload()` in backend/app/services/cc_jv.py, which
 * email automation uses because it has no browser. The two are pinned together by
 * `contracts/cc-jv.contract.json` — read `ccJv.contract.test.ts` before changing
 * any field here, and change the Python side in the same commit.
 *
 * `config` is already normalised: `useOcrSubmission` resolves the snake_case API shape
 * and the camelCase localStorage shape into these four fields before calling, which is
 * where that concern belongs (it is about where the config came from, not what a JV is).
 */
export function buildGljvPayload(
  rows: JvRow[],
  opts: { docDate?: string; bankCode?: string; config: GljvConfig }
): Record<string, unknown> {
  const { docDate, bankCode, config } = opts
  // Per-bank wording when the BU set one, else the BU's single description — the
  // input-tax record built from the same statement resolves it the same way, so the
  // two documents never disagree about what they are.
  const base = descriptionForBank(config.description, config.bankDescriptions, bankCode)

  return {
    JvhSeq: -1,
    JvhDate: jvhDate(docDate),
    Prefix: config.filePrefix || '',
    JvhNo: 'Auto',
    // Source follows the scanned bank (single authority), not stale saved config;
    // fall back to stored config only when the bank is unknown.
    JvhSource: (bankCode && codeToSource(bankCode)) || config.fileSource || '',
    Status: 'Draft',
    Description: base ? `${base}${docDate ? ` - ${docDate}` : ''}` : '',
    // Drop display-only zero legs (e.g. gateway net=0.00 shown in Step 3 for a
    // standard layout) — never post empty GL lines to Carmen.
    Detail: rows
      .filter(r => r.debit || r.credit)
      .map(r => ({
        JvhSeq: -1,
        JvdSeq: -1,
        DeptCode: r.dept,
        AccCode: r.acc,
        Description: r.desc,
        CurCode: 'THB',
        CurRate: 1,
        CrAmount: round2(r.credit),
        CrBase: round2(r.credit),
        DrAmount: round2(r.debit),
        DrBase: round2(r.debit),
        DimList: {},
      })),
    DimHList: { Dim: [] },
    // Empty from the wizard, 'OCR-EMAIL' from email ingest — the field exists so
    // accounting can tell a machine-posted JV from a reviewed one. Deliberately
    // outside the shared contract (CARMEN_INTEGRATION.md §4 point 3).
    UserModified: '',
  }
}

/**
 * 'DD/MM/YYYY' (CE or BE) → ISO-8601. Falls back to now, as the server twin does.
 *
 * The day and month MUST arrive zero-padded. `new Date('2026-8-5')` is parsed as
 * *local* time and lands on the previous day in UTC, while `new Date('2026-08-05')`
 * is parsed as UTC. Both producers pad — `normalizeDateStringToCE()` at extraction
 * and `formatDateToDDMMYYYY()` in the date picker — so this is safe; keep it that way.
 */
function jvhDate(docDate?: string): string {
  if (docDate) {
    const [d, m, y] = docDate.split('/')
    const parsed = new Date(`${normalizeYearToCE(y)}-${m}-${d}`)
    if (!isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return new Date().toISOString()
}
