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
      { code: '101', name: 'Rooms' },
    ],
    prefixes: [],
    loading: false,
  }),
}))

const api = await import('@/features/credit-card/api/pmsReview')

const DAY: PmsDay = {
  id: 'day-1',
  interface: 'Comanche',
  doc_type: 'Daily',
  doc_date: '2024-09-05',
  reason_code: null,
  error_message: null,
  terms: [
    { type: 'Revenue', amount: '1127.00' },
    { type: 'Payment', amount: '-500.00' },
    { type: 'Guest Ledger', amount: '-627.00' },
  ],
  off: '0.00',
  codes: 4,
  accounts: {
    'Revenue|100': { dept: '101', acc: '4010001' },
    'VAT|*': { dept: 'GEN', acc: '2012002' },
    'SVC|*': { dept: 'GEN', acc: '2013002' },
    'Payment|900': { dept: '101', acc: '1010001' },
    'Ledger|Guest Ledger': { dept: '101', acc: '1021001' },
  },
  new_codes: [
    {
      key: 'Revenue|729',
      code: '729',
      description: 'Rebate - Misc. (VAT)',
      type: 'Revenue',
      amount: '-50.00',
      dept: '304',
      acc: '4240011',
      confidence: 'medium',
      why: 'rebate',
    },
  ],
  rows: [
    { type: 'Revenue', code: '100', desc: 'Room Charge', amount: '1000.00' },
    { type: 'Revenue', code: '100', desc: 'Room Charge - SERVICE', amount: '100.00' },
    { type: 'Revenue', code: '100', desc: 'Room Charge - VAT', amount: '77.00' },
    { type: 'Revenue', code: '729', desc: 'Rebate - Misc. (VAT)', amount: '-50.00' },
    { type: 'Payment', code: '900', desc: 'Cash', amount: '-500.00' },
    { type: 'Guest Ledger', code: 'Guest Ledger', desc: 'Guest Ledger', amount: '627.00' },
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
  it('reads as the day it is: balance by PMS type, then only the new code', async () => {
    open()
    expect(await screen.findByText('Comanche · Daily ·', { exact: false })).toBeInTheDocument()
    const balance = screen.getByRole('region', { name: 'Balance' })
    expect(within(balance).getAllByText('1,127.00').length).toBeGreaterThan(0)
    expect(within(balance).getByText('Guest Ledger (reversed)')).toBeInTheDocument()
    const accounts = screen.getByRole('region', { name: 'Accounts' })
    expect(within(accounts).getByText('1 new, mapped by AI')).toBeInTheDocument()
    expect(within(accounts).getByText('729')).toBeInTheDocument()
    expect(within(accounts).getByText('AI')).toBeInTheDocument()
    // Carmen's name and name2 are the same words; the code says them once.
    expect(within(accounts).getByText('→ OT : Rebate Other Revenue')).toBeInTheDocument()
  })

  it('posts with the account the reviewer kept', async () => {
    vi.mocked(api.approvePmsDay).mockResolvedValue({ jv_no: 'JV2409-0066' })
    const { onDone } = open()
    await screen.findByText('729')
    expect(screen.getByText(/Also saves the new codes/)).toBeInTheDocument()
    fireEvent.click(approveButton())
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(api.approvePmsDay).toHaveBeenCalledWith('day-1', {
      'Revenue|729': { dept: '304', acc: '4240011' },
    })
  })

  it('cannot approve a new code with no account, and says why', async () => {
    open({ ...DAY, new_codes: [{ ...DAY.new_codes[0], dept: null, acc: null }] })
    await screen.findByText('729')
    expect(approveButton()).toBeDisabled()
    expect(screen.getByText('Pick an account for every new code.')).toBeInTheDocument()
  })

  it('cannot approve a day that does not balance', async () => {
    open({ ...DAY, off: '120.00', terms: [{ type: 'Revenue', amount: '1247.00' }] })
    await screen.findByText('729')
    expect(approveButton()).toBeDisabled()
    expect(screen.getByText(/Doesn't balance\. Fix it in Comanche/)).toBeInTheDocument()
    expect(screen.getByText('Off by 120.00')).toBeInTheDocument()
  })

  it('shows the JV first and the PMS rows on their chip', async () => {
    open()
    await screen.findByText('729')
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Balanced')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /PMS rows/ }))
    expect(
      within(screen.getByRole('tabpanel')).getByText('Net, Guest Ledger reversed')
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
