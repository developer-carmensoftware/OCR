import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'
import PmsReviewDocument from './PmsReviewDocument'
import type { PmsDay } from '@/features/credit-card/api/pmsReview'

vi.mock('@/features/credit-card/api/pmsReview', () => ({
  getPmsDay: vi.fn(),
  approvePmsDay: vi.fn(),
  rejectPmsDay: vi.fn(),
}))
vi.mock('@/features/credit-card/hooks/mapping/useGlMasters', () => ({
  useGlMasters: () => ({
    accounts: [
      { code: '4240011', name: 'OT : Rebate Other Revenue', name2: 'OT : Rebate Other Revenue' },
      { code: '4010001', name: 'Room Revenue' },
      { code: '1010001', name: 'Cash on hand' },
    ],
    departments: [
      { code: '304', name: 'Other' },
      { code: '103', name: 'Rooms' },
    ],
    prefixes: [],
    loading: false,
  }),
}))

const api = await import('@/features/credit-card/api/pmsReview')

const REBATE = '["729","Rebate - Misc. (VAT)"]'
const DAY: PmsDay = {
  id: 'day-1',
  interface: 'Comanche',
  doc_type: 'Daily',
  doc_date: '2024-09-05',
  reason_code: null,
  error_message: null,
  setting_code: 'Comanche.PMS',
  post_type: 'REVENUE',
  counter: { dept: 'GEN', acc: '1021001', name: 'A/R - Guest Ledger' },
  key_columns: ['Code', 'Description'],
  rows: [
    {
      key: '["100","Room Charge"]',
      values: { Code: '100', Description: 'Room Charge' },
      amount: '1000.00',
      dept: '103',
      acc: '4010001',
      name: 'Room Revenue',
    },
    { key: REBATE, values: { Code: '729', Description: 'Rebate - Misc. (VAT)' }, amount: '-50.00' },
    {
      key: '["900","Cash"]',
      values: { Code: '900', Description: 'Cash' },
      amount: '-500.00',
      dept: 'GEN',
      acc: '1010001',
      name: 'Cash on hand',
    },
  ],
  mapped_count: 2,
  new_codes: [
    {
      key: REBATE,
      label: '729 · Rebate - Misc. (VAT)',
      values: { Code: '729', Description: 'Rebate - Misc. (VAT)' },
      amount: '-50.00',
      dept: '304',
      acc: '4240011',
      confidence: 'medium',
      why: 'rebate',
    },
  ],
}

function open(day: PmsDay = DAY) {
  vi.mocked(api.getPmsDay).mockResolvedValue(day)
  const onDone = vi.fn()
  const onClose = vi.fn()
  render(
    <LanguageProvider>
      <PmsReviewDocument id={day.id} onClose={onClose} onDone={onDone} />
    </LanguageProvider>
  )
  return { onDone, onClose }
}

const approveButton = () => screen.getByRole('button', { name: /approve and post/i })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('lang', 'en')
})

describe('a parked PMS day', () => {
  it('says Carmen posts it with its own setting, and asks only about the new row', async () => {
    open()
    expect(await screen.findByText('Comanche · Daily ·', { exact: false })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Carmen posts this day with its Comanche.PMS setting (REVENUE): it decides debit and credit, and posts the remainder to GEN/1021001 A/R - Guest Ledger.'
      )
    ).toBeInTheDocument()
    // No balance of our own: the sides are Carmen's.
    expect(screen.queryByText(/balance/i)).not.toBeInTheDocument()
    const accounts = screen.getByRole('region', { name: 'Accounts' })
    expect(within(accounts).getByText('1 new, mapped by AI')).toBeInTheDocument()
    expect(within(accounts).getByText('2 mapped in Carmen')).toBeInTheDocument()
    expect(within(accounts).getByText('729')).toBeInTheDocument()
    expect(within(accounts).getByText('AI')).toBeInTheDocument()
    // Carmen's name and name2 are the same words; the row says them once.
    expect(within(accounts).getByText('→ OT : Rebate Other Revenue')).toBeInTheDocument()
  })

  it('lists every PMS row as sent, with what Carmen maps it to', async () => {
    open()
    const rows = await screen.findByRole('region', { name: 'PMS rows' })
    expect(within(rows).getByText('Room Revenue')).toBeInTheDocument()
    // The PMS's own sign, with a true minus.
    expect(within(rows).getByText('−500.00')).toBeInTheDocument()
    expect(within(rows).getAllByText('New')).toHaveLength(1)
  })

  it("posts with the account the reviewer kept, and says it goes into Carmen's mapping", async () => {
    vi.mocked(api.approvePmsDay).mockResolvedValue({ jv_no: null, already_posted: false })
    const { onDone } = open()
    await screen.findAllByText('729')
    expect(
      screen.getByText(
        "Saves the new accounts to Carmen's Comanche mapping, then Carmen posts the day."
      )
    ).toBeInTheDocument()
    fireEvent.click(approveButton())
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(api.approvePmsDay).toHaveBeenCalledWith('day-1', {
      [REBATE]: { dept: '304', acc: '4240011' },
    })
  })

  it('cannot approve a new row with no account, and says why', async () => {
    open({ ...DAY, new_codes: [{ ...DAY.new_codes[0], dept: null, acc: null }] })
    await screen.findAllByText('729')
    expect(approveButton()).toBeDisabled()
    expect(screen.getByText('Pick an account for every new row.')).toBeInTheDocument()
  })

  it('a fully mapped day only needs Approve', async () => {
    open({ ...DAY, new_codes: [], mapped_count: 3 })
    await screen.findByText('All 3 mapped in Carmen')
    expect(approveButton()).toBeEnabled()
    expect(screen.getByText('Carmen posts the day with its Comanche setting.')).toBeInTheDocument()
  })

  it("keeps Carmen's refusal on screen in Carmen's words", async () => {
    vi.mocked(api.approvePmsDay).mockRejectedValue(
      Object.assign(new Error("Carmen didn't post the day: Mapping is incomplete."), {
        status: 400,
      })
    )
    open()
    await screen.findAllByText('729')
    fireEvent.click(approveButton())
    expect(
      await screen.findByText("Carmen didn't post the day: Mapping is incomplete.")
    ).toBeInTheDocument()
  })

  it('a day someone else handled says so', async () => {
    vi.mocked(api.getPmsDay).mockRejectedValue(new Error('404'))
    render(
      <LanguageProvider>
        <PmsReviewDocument id="gone" onClose={vi.fn()} onDone={vi.fn()} />
      </LanguageProvider>
    )
    expect(await screen.findByText('This day is not waiting for review')).toBeInTheDocument()
  })
})
