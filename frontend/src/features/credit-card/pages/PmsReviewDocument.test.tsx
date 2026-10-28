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
const ROOM = '["100","Room Charge"]'
const DAY: PmsDay = {
  id: 'day-1',
  interface: 'Comanche',
  doc_type: 'Daily',
  doc_date: '2024-09-05',
  reason_code: null,
  error_message: null,
  key_columns: ['Code', 'Description'],
  rows: [
    {
      key: ROOM,
      values: { Code: '100', Description: 'Room Charge' },
      dept: '103',
      acc: '4010001',
      name: 'Room Revenue',
    },
    { key: REBATE, values: { Code: '729', Description: 'Rebate - Misc. (VAT)' } },
    {
      key: '["900","Cash"]',
      values: { Code: '900', Description: 'Cash' },
      dept: 'GEN',
      acc: '1010001',
      name: 'Cash on hand',
    },
    // The PMS wrote Room Charge twice; with no amount on screen it is one row.
    {
      key: ROOM,
      values: { Code: '100', Description: 'Room Charge' },
      dept: '103',
      acc: '4010001',
      name: 'Room Revenue',
    },
  ],
  mapped_count: 2,
  new_codes: [
    {
      key: REBATE,
      label: '729 · Rebate - Misc. (VAT)',
      values: { Code: '729', Description: 'Rebate - Misc. (VAT)' },
      dept: '304',
      acc: '4240011',
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
  it('is one table laid out as Carmen maps, and nothing about the sides', async () => {
    open()
    expect(await screen.findByText('Comanche · Daily ·', { exact: false })).toBeInTheDocument()
    // No balance, no amounts, no note on who decides the sides: they are Carmen's.
    expect(screen.queryByText(/balance/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/decides debit and credit/)).not.toBeInTheDocument()
    expect(screen.queryByText('Amount')).not.toBeInTheDocument()
    const accounts = screen.getByRole('region', { name: 'Accounts' })
    expect(within(accounts).getByText('3 rows')).toBeInTheDocument()
    expect(within(accounts).getAllByRole('table')).toHaveLength(1)
    expect(
      within(accounts)
        .getAllByRole('columnheader')
        .map(h => h.textContent)
    ).toEqual(['Code', 'Description', 'DeptCode', 'AccCode', 'AccDesc'])
    // The new row first, then Carmen's rows in the PMS's order, a repeated key once.
    const codes = within(accounts)
      .getAllByRole('row')
      .slice(1)
      .map(row => within(row).getAllByRole('cell')[0].textContent)
    expect(codes).toEqual(['729', '100', '900'])
  })

  it("names the AI's account in AccDesc, tagged AI, with no tick to make", async () => {
    open()
    const accounts = await screen.findByRole('region', { name: 'Accounts' })
    const row = within(accounts).getByText('729').closest('tr') as HTMLElement
    // Carmen's name and name2 are the same words; AccDesc says the short name once.
    expect(within(row).getByText('OT : Rebate Other Revenue')).toBeInTheDocument()
    expect(within(row).getByText('AI')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('shows the rows Carmen maps as text, not pickers', async () => {
    open()
    const accounts = await screen.findByRole('region', { name: 'Accounts' })
    const row = within(accounts).getByText('900').closest('tr') as HTMLElement
    expect(within(row).getByText('GEN')).toBeInTheDocument()
    expect(within(row).getByText('1010001')).toBeInTheDocument()
    expect(within(row).getByText('Cash on hand')).toBeInTheDocument()
    expect(within(row).queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
  })

  it("approves the AI's accounts straight away: Approve is the person's yes", async () => {
    vi.mocked(api.approvePmsDay).mockResolvedValue({ jv_no: null, already_posted: false })
    const { onDone } = open()
    await screen.findAllByText('729')
    expect(approveButton()).toBeEnabled()
    expect(
      screen.getByText(
        "Adds the new rows (1) to Carmen's Comanche mapping, which every later day uses. Then Carmen posts 05/09/2024."
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
    expect(screen.getByLabelText('Account for 729 · Rebate - Misc. (VAT)')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true })
    expect(api.approvePmsDay).not.toHaveBeenCalled()
  })

  it("picking another account drops the AI tag; Undo puts the AI's back", async () => {
    open()
    const accounts = await screen.findByRole('region', { name: 'Accounts' })
    fireEvent.click(screen.getByLabelText('Account for 729 · Rebate - Misc. (VAT)'))
    fireEvent.mouseDown(screen.getByRole('button', { name: /4010001/ }))
    const row = within(accounts).getByText('729').closest('tr') as HTMLElement
    expect(within(row).queryByText('AI')).not.toBeInTheDocument()
    expect(within(row).getByText('Room Revenue')).toBeInTheDocument()
    expect(approveButton()).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Undo 729 · Rebate - Misc. (VAT)' }))
    expect(within(row).getByText('AI')).toBeInTheDocument()
    expect(within(row).getByText('OT : Rebate Other Revenue')).toBeInTheDocument()
  })

  it('Ctrl+Enter approves', async () => {
    vi.mocked(api.approvePmsDay).mockResolvedValue({ jv_no: null, already_posted: false })
    const { onDone } = open()
    await screen.findAllByText('729')
    expect(approveButton()).toHaveAttribute('aria-keyshortcuts', 'Control+Enter')
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('Ctrl+Enter does nothing behind the reject question', async () => {
    open()
    await screen.findAllByText('729')
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true })
    expect(api.approvePmsDay).not.toHaveBeenCalled()
  })

  it('a fully mapped day only needs Approve', async () => {
    open({ ...DAY, new_codes: [], mapped_count: 3 })
    await screen.findByText('2 rows')
    expect(approveButton()).toBeEnabled()
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    // Nothing goes into Carmen's mapping, so the footer has nothing to warn about.
    expect(screen.queryByText(/Carmen posts/)).not.toBeInTheDocument()
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
