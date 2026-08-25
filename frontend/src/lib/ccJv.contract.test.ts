import { describe, it, expect } from 'vitest'
import { buildJvRows, buildGljvPayload } from './ccJv'
import { BANK_SOURCE_MAP, OCR_BANK_MAP } from '../constants/banks'
// Imported, not read off disk: Vite resolves JSON natively (resolveJsonModule), so this
// needs no node builtins and the path is checked at build time rather than at runtime.
import contract from '../../../contracts/cc-jv.contract.json'

/**
 * Cross-language contract.
 *
 * `ccJv.test.ts` pins this side against hand-written expectations, and
 * `backend/tests/unit/test_cc_jv.py` pins the Python twin against its own. Neither
 * checked that the two AGREE — and they must, because the wizard and email automation
 * post the same Carmen `gljv` body from two implementations kept in step by hand. A
 * drift there posts wrong money and nothing goes red.
 *
 * `contracts/cc-jv.contract.json` is the shared source of truth. The Python test
 * reads the same file; change an expectation and both suites fail together, which is
 * the whole point. See the `$comment` block in the fixture for the deliberate
 * differences (UserModified, JvhDate string form, backend-only fuzzy matching).
 */

interface Case {
  name: string
  bankCode: string
  docDate: string
  config: {
    filePrefix: string
    fileSource: string
    description: string
    bankDescriptions: Record<string, string>
  }
  mappings: Record<string, { dept: string; acc: string }>
  paymentTypes: Record<string, { dept: string; acc: string }>
  details: Record<string, string>[]
  expectedJvhDateUtc: string
  expected: Record<string, unknown>
}

const CONTRACT = contract as unknown as {
  bankSourceMap: Record<string, string>
  cases: Case[]
}

describe('cc JV cross-language contract', () => {
  it('bank code → GL source table matches the fixture', () => {
    // Ours is keyed by display name via OCR_BANK_MAP; the Python map and the fixture
    // are keyed by code. Project ours down to codes before comparing, so all three
    // copies are pinned to one table.
    const byCode = Object.fromEntries(
      Object.entries(OCR_BANK_MAP).map(([code, display]) => [
        code,
        BANK_SOURCE_MAP[display as keyof typeof BANK_SOURCE_MAP],
      ])
    )
    const expected = Object.fromEntries(
      Object.entries(CONTRACT.bankSourceMap).filter(([k]) => !k.startsWith('$'))
    )
    expect(byCode).toEqual(expected)
    // Guard against a code being dropped from OCR_BANK_MAP: codeToSource() would then
    // silently return '' and the JV would post with no source at all.
    expect(Object.keys(byCode).sort()).toEqual(Object.keys(expected).sort())
  })

  it.each(CONTRACT.cases.map(c => [c.name, c] as const))('%s', (_name, c) => {
    // The Python builder takes one merged mapping dict; ours takes fixed types and
    // payment types separately. The fixture keeps them apart so neither side's shape
    // is baked into the shared file.
    const rows = buildJvRows(
      c.details,
      { mappings: c.mappings, paymentAmount: c.paymentTypes },
      {
        // GROUP_DEBIT_BY_TRANSACTION is false, so the wizard always consolidates —
        // which is the only layout the Python twin implements.
        consolidateDebit: true,
      }
    )

    const body = buildGljvPayload(rows, {
      docDate: c.docDate,
      bankCode: c.bankCode,
      config: c.config,
    })

    // Compared as an instant, not a string: JS emits '.000Z' where Python emits
    // '+00:00' for the same moment, and Carmen sees no difference.
    const { JvhDate, UserModified, ...rest } = body
    expect(new Date(JvhDate as string).getTime()).toBe(new Date(c.expectedJvhDateUtc).getTime())

    // Deliberately outside the shared contract — the field is what tells a
    // machine-posted JV from a reviewed one, so the two sides MUST differ here.
    expect(UserModified).toBe('')

    expect(rest).toEqual(c.expected)
  })

  it('every case posts a balanced JV', () => {
    // Cheap invariant on the fixture itself: if a future edit unbalances a case, the
    // per-case assertions above would happily pin a JV Carmen must reject.
    for (const c of CONTRACT.cases) {
      const detail = c.expected.Detail as { DrAmount: number; CrAmount: number }[]
      const dr = detail.reduce((s, r) => s + r.DrAmount, 0)
      const cr = detail.reduce((s, r) => s + r.CrAmount, 0)
      expect(Math.abs(dr - cr), `${c.name}: Dr ${dr} vs Cr ${cr}`).toBeLessThan(0.005)
    }
  })
})
