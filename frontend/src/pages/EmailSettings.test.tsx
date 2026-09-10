import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import EmailSettings from './EmailSettings'
import type { EmailRule, EmailRulePayload } from '../lib/api/emailAutomation'

/**
 * This screen's first tests, and they exist for one reason.
 *
 * `PUT /api/v1/carmen/settings` is a FULL REPLACE of the rules array. This page rebuilds
 * that array from what it has in memory, so any field it does not know about is a field it
 * deletes from every rule the moment someone edits an unrelated one. `auto_post` already
 * had to be given a merge rule after exactly that happened in production (2026-09-08);
 * `doc_type` is the next field with the same exposure, and losing it turns a settlement
 * report back into a commission invoice — read with the wrong layout, posted to the wrong
 * accounts.
 */

const setRules = vi.fn(async (_rules: EmailRulePayload[]) => true)
let rules: EmailRule[] = []

vi.mock('../hooks/email-settings', () => ({
  useEmailSettings: () => ({
    settings: {
      host: 'hotel.carmenwork.com',
      bu: 'hq',
      enabled: true,
      auto_post: false,
      entitled: true,
      ingest_address: 'AIAGENT+abc123@carmensoftware.com',
      owner_emails: ['acct@hotel.com'],
      tax_ids: ['0105536000123'],
      rules,
      status: { blockers: [] },
      gmail_confirmed_at: null,
      has_token: true,
    },
    loading: false,
    saving: false,
    error: null,
    fieldErrors: {},
    host: 'hotel.carmenwork.com',
    bu: 'hq',
    tokenStatus: null,
    banks: [
      { code: 'KBANK', name: 'Kasikornbank' },
      { code: 'KTC', name: 'Krungthai Card' },
    ],
    setRules,
    setOwnerEmails: vi.fn(),
    setTaxIds: vi.fn(),
    setEnabled: vi.fn(),
    setAutoPost: vi.fn(),
    saveToken: vi.fn(),
    removeToken: vi.fn(),
    reload: vi.fn(),
  }),
}))
vi.mock('../lib/toast', () => ({ showToast: vi.fn() }))

function mount() {
  return render(
    <LanguageProvider>
      <EmailSettings />
    </LanguageProvider>
  )
}

/** The rules array the page last PUT. */
function lastPut(): EmailRulePayload[] {
  const calls = setRules.mock.calls
  return calls[calls.length - 1][0]
}

beforeEach(() => {
  vi.clearAllMocks()
  rules = []
})

describe('bank rules', () => {
  it('can tag a rule as a settlement report', async () => {
    // Otherwise there is no way to switch AR reconciliation on at all: Carmen's own
    // settings screen does not know the field either.
    mount()
    fireEvent.click(screen.getByRole('button', { name: /Add your first bank/i }))

    fireEvent.change(screen.getByLabelText(/Document type/i), {
      target: { value: 'ar_reconcile' },
    })
    fireEvent.change(screen.getByLabelText(/^Bank$/i), { target: { value: 'KBANK' } })
    fireEvent.change(screen.getByLabelText(/Filename patterns/i), {
      target: { value: 'KB1P554V2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Save bank/i }))

    await waitFor(() => expect(setRules).toHaveBeenCalled())
    expect(lastPut()).toEqual([
      expect.objectContaining({
        bank_code: 'KBANK',
        doc_type: 'ar_reconcile',
        filename_patterns: ['KB1P554V2'],
      }),
    ])
  })

  it('editing one rule does not downgrade another rule’s document type', async () => {
    rules = [
      {
        bank_code: 'KBANK',
        bank_sender_email: null,
        filename_patterns: ['KB1P554V2'],
        is_active: true,
        doc_type: 'ar_reconcile',
      },
      {
        bank_code: 'KTC',
        bank_sender_email: null,
        filename_patterns: ['.pdf'],
        is_active: true,
        doc_type: 'fee_invoice',
      },
    ]
    mount()

    // Touch the KTC rule only, and change nothing about it.
    fireEvent.click(screen.getByRole('button', { name: /Edit KTC/i }))
    fireEvent.click(screen.getByRole('button', { name: /Save bank/i }))

    await waitFor(() => expect(setRules).toHaveBeenCalled())
    const put = lastPut()
    expect(put[0].doc_type).toBe('ar_reconcile')
    expect(put[1].doc_type).toBe('fee_invoice')
  })

  it('deleting a rule leaves the others’ document types alone', async () => {
    rules = [
      {
        bank_code: 'KBANK',
        bank_sender_email: null,
        filename_patterns: ['KB1P554V2'],
        is_active: true,
        doc_type: 'ar_reconcile',
      },
      {
        bank_code: 'KTC',
        bank_sender_email: null,
        filename_patterns: ['.pdf'],
        is_active: true,
      },
    ]
    mount()

    fireEvent.click(screen.getByRole('button', { name: /Remove KTC/i }))

    await waitFor(() => expect(setRules).toHaveBeenCalled())
    expect(lastPut()).toEqual([expect.objectContaining({ doc_type: 'ar_reconcile' })])
  })

  it('a rule stored before the field existed reads as the type it was', async () => {
    rules = [
      { bank_code: 'KTC', bank_sender_email: null, filename_patterns: ['.pdf'], is_active: true },
    ]
    mount()

    fireEvent.click(screen.getByRole('button', { name: /Edit KTC/i }))
    fireEvent.click(screen.getByRole('button', { name: /Save bank/i }))

    await waitFor(() => expect(setRules).toHaveBeenCalled())
    expect(lastPut()[0].doc_type).toBe('fee_invoice')
  })

  it('marks a settlement-report rule in the list', async () => {
    rules = [
      {
        bank_code: 'KBANK',
        bank_sender_email: null,
        filename_patterns: ['KB1P554V2'],
        is_active: true,
        doc_type: 'ar_reconcile',
      },
    ]
    mount()

    // A mistagged rule is the failure that costs a document, so it is visible without
    // opening the row.
    expect(screen.getByText('settlement report')).toBeInTheDocument()
  })
})
