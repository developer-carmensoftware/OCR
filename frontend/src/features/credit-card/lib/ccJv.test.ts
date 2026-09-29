import { describe, it, expect } from 'vitest'
import { buildJvRows, buildGljvPayload } from './ccJv'

// Shared debit accounts + per-payment-type credit accounts, mirroring accountingConfig.
const config = {
  mappings: {
    commission: { dept: 'GEN', acc: '5100' },
    tax: { dept: 'GEN', acc: '1150' },
    net: { dept: 'GEN', acc: '1010' },
  },
  paymentAmount: {
    Visa: { dept: 'GEN', acc: '1130V' },
    MasterCard: { dept: 'GEN', acc: '1130M' },
    JCB: { dept: 'GEN', acc: '1130J' },
  },
}

const sum = (rows: { debit: number; credit: number }[], side: 'debit' | 'credit') =>
  rows.reduce((s, r) => s + r[side], 0)

describe('buildJvRows', () => {
  it('consolidated (default for all banks): one debit line per account, credit per payment type', () => {
    const details = [
      {
        Transaction: 'Visa',
        PayAmt: '1000.00',
        CommisAmt: '30.00',
        TaxAmt: '2.10',
        Total: '967.90',
      },
      {
        Transaction: 'MasterCard',
        PayAmt: '500.00',
        CommisAmt: '15.00',
        TaxAmt: '1.05',
        Total: '483.95',
      },
      { Transaction: 'JCB', PayAmt: '300.00', CommisAmt: '9.00', TaxAmt: '0.63', Total: '290.37' },
    ]
    const rows = buildJvRows(details, config, { consolidateDebit: true })

    const credits = rows.filter(r => r.credit > 0)
    const debits = rows.filter(r => r.debit > 0)
    expect(credits).toHaveLength(3) // one per payment type
    expect(debits).toHaveLength(3) // commission + tax + net, merged

    const byDesc = (d: string) => debits.find(r => r.desc === d)!
    expect(byDesc('Credit card commission').debit).toBeCloseTo(54.0, 2)
    expect(byDesc('Input Tax').debit).toBeCloseTo(3.78, 2)
    expect(byDesc('Bank Account').debit).toBeCloseTo(1742.22, 2)

    // JV stays balanced
    expect(sum(rows, 'debit')).toBeCloseTo(sum(rows, 'credit'), 2)
    expect(sum(rows, 'credit')).toBeCloseTo(1800.0, 2)
  })

  it('gateway fee invoice (Total=0): standard 3 debit legs incl a 0.00 Bank Account row', () => {
    const details = [
      { Transaction: 'MDR Fee', PayAmt: '107.00', CommisAmt: '100.00', TaxAmt: '7.00', Total: '0' },
      { Transaction: 'Txn Fee', PayAmt: '53.50', CommisAmt: '50.00', TaxAmt: '3.50', Total: '0' },
    ]
    const feeConfig = {
      mappings: config.mappings,
      paymentAmount: {
        'MDR Fee': { dept: 'GEN', acc: '2100' },
        'Txn Fee': { dept: 'GEN', acc: '2100' },
      },
    }
    const rows = buildJvRows(details, feeConfig, { consolidateDebit: true })
    // All three debit buckets appear in fixed order, even the zero one (standard layout).
    const debitDescs = rows.filter(r => r.credit === 0).map(r => r.desc)
    expect(debitDescs).toEqual(['Credit card commission', 'Input Tax', 'Bank Account'])
    const bank = rows.find(r => r.desc === 'Bank Account')!
    expect(bank.debit).toBe(0)
    expect(rows.find(r => r.desc === 'Credit card commission')!.debit).toBeCloseTo(150.0, 2)
    // The zero leg carries no amount, so the JV still balances and it drops out at submit.
    expect(sum(rows, 'debit')).toBeCloseTo(sum(rows, 'credit'), 2)
  })

  it('consolidated with empty details emits nothing (Submit stays disabled)', () => {
    expect(buildJvRows([], config, { consolidateDebit: true })).toEqual([])
    const blank = [{ Transaction: '', PayAmt: '', CommisAmt: '', TaxAmt: '', Total: '' }]
    expect(buildJvRows(blank, config, { consolidateDebit: true })).toEqual([])
  })

  it('per-line mode (consolidateDebit off, preserved for future use): per-line rows', () => {
    const details = [
      {
        Transaction: 'Visa',
        PayAmt: '1000.00',
        CommisAmt: '30.00',
        TaxAmt: '2.10',
        Total: '967.90',
      },
      {
        Transaction: 'Visa',
        PayAmt: '500.00',
        CommisAmt: '15.00',
        TaxAmt: '1.05',
        Total: '483.95',
      },
    ]
    const rows = buildJvRows(details, config)
    // 2 lines × (1 credit + 3 debits) = 8 rows, none merged
    expect(rows).toHaveLength(8)
    expect(rows.filter(r => r.desc === 'Credit card commission')).toHaveLength(2)
    expect(sum(rows, 'debit')).toBeCloseTo(sum(rows, 'credit'), 2)
  })
})

// Ticket D (2026-09-22): one description mechanism, not two. The fee-invoice path's
// plain `base - docDate` concatenation and a settlement JV's template both go through
// the same decision now — twin of cc_jv.py's render_description/build_gljv_payload
// tests, so a change to one side without the other shows up here.
describe('buildGljvPayload — Description', () => {
  it('falls back to plain concatenation when the saved value has no template tag', () => {
    const payload = buildGljvPayload([], {
      docDate: '15/06/2026',
      docNo: 'DOC-1',
      bankCode: 'BAY',
      config: { filePrefix: 'IC', fileSource: 'ACBY', description: 'Credit Card Commission' },
    })
    expect(payload.Description).toBe('Credit Card Commission - 15/06/2026')
  })

  it('treats a value with a tag as a full template, and does not also append the date', () => {
    const payload = buildGljvPayload([], {
      docDate: '21/07/2026',
      docNo: '210726E00035291',
      bankCode: 'KBANK',
      config: {
        filePrefix: 'IC',
        fileSource: 'ACKB',
        bankDescriptions: { KBANK: 'Credit Card AR Reconcile {Settlement_Date}' },
      },
    })
    expect(payload.Description).toBe('Credit Card AR Reconcile 21/07/2026')
  })

  it('renders every tag, and collapses an unset one rather than printing it literally', () => {
    const payload = buildGljvPayload([], {
      docDate: '21/07/2026',
      docNo: '210726E00035291',
      bankCode: 'KBANK',
      config: {
        filePrefix: 'IC',
        fileSource: 'ACKB',
        bankDescriptions: { KBANK: '{Bank_Name} {Tax_Invoice_No} {Settlement_Date}' },
      },
    })
    expect(payload.Description).toBe('KBANK 210726E00035291 21/07/2026')
  })

  it('is empty when nothing is saved for this bank', () => {
    const payload = buildGljvPayload([], {
      docDate: '21/07/2026',
      bankCode: 'KBANK',
      config: { filePrefix: 'IC', fileSource: 'ACKB' },
    })
    expect(payload.Description).toBe('')
  })
})
