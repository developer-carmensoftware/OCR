import type React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import ReviewDocument from './ReviewDocument'
import type { ReviewDocumentDetail } from '../lib/api/emailReview'
import type { AccountingState } from '../components/credit-card/AccountingReview'

vi.mock('../lib/api/emailReview', () => ({
  getPending: vi.fn(),
  approveDocument: vi.fn(),
  rejectDocument: vi.fn(),
}))
vi.mock('../components/common/UsageIndicator', () => ({ default: () => null }))
vi.mock('../components/common/AppHeader', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <header>{children}</header>,
}))

// AccountingReview reaches Carmen for account names and the BU's config. Its own suite
// covers what it computes; here it is a stand-in that reports whatever state a test wants.
let accState: AccountingState = {
  rows: [{ dept: 'GEN', acc: '1010' }],
  blocked: false,
  unmappedFields: [],
} as unknown as AccountingState
vi.mock('../components/credit-card/AccountingReview', async () => {
  const { useEffect } = await import('react')
  // From an effect, like the real component: reporting during render is a setState in
  // the parent mid-render, which React refuses.
  function MockAccountingReview({ onState }: { onState?: (s: AccountingState) => void }) {
    useEffect(() => onState?.(accState), [onState])
    return <div data-testid="accounting" />
  }
  return { default: MockAccountingReview }
})

const api = await import('../lib/api/emailReview')

const EXTRACTED = {
  id: 'card-1',
  bank_name: 'KTC',
  doc_no: 'INV-001',
  doc_date: '15/01/2026',
  company_name: 'Test Hotel',
  branch_no: '00000',
  warnings: [],
  details: [
    {
      transaction: 'Visa',
      pay_amt: '1000.00',
      commis_amt: '30.00',
      tax_amt: '2.10',
      total: '967.90',
    },
  ],
}

function detail(over: Partial<ReviewDocumentDetail> = {}): ReviewDocumentDetail {
  return {
    id: 'd1',
    created_at: null,
    attachment: 'july.pdf',
    status: 'pending_review',
    bank_code: 'KTC',
    doc_no: 'INV-001',
    doc_date: '15/01/2026',
    total: 1000,
    line_count: 1,
    flags: [],
    jv_no: null,
    reason_code: null,
    error_message: null,
    reviewed_by_name: null,
    reviewed_at: null,
    extracted: EXTRACTED,
    ...over,
  }
}

// Approve stays disabled until AccountingReview reports — clicking before that is a
// no-op, which would pass as "nothing posted" for the wrong reason.
async function clickApprove() {
  const btn = await screen.findByRole('button', { name: /Approve and post/ })
  await waitFor(() => expect(btn).toBeEnabled())
  fireEvent.click(btn)
}

function mount() {
  return render(
    <LanguageProvider>
      <ReviewDocument />
    </LanguageProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.location.hash = '#/CreditCardOCR/review?id=d1'
  accState = {
    rows: [{ dept: 'GEN', acc: '1010' }],
    blocked: false,
    unmappedFields: [],
  } as unknown as AccountingState
})

describe('loading a parked document', () => {
  it('loads snake_case details into the PascalCase editor', async () => {
    // The payload is the raw /extract shape. Skipping the bridge would silently render
    // every row empty rather than failing, which is the worst possible way to be wrong
    // about money.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    // Collapsed by design when nothing is flagged, so open the two sections to read them.
    const docBtn = await screen.findByRole('button', { name: /Document/ })
    await waitFor(() => expect(docBtn).toHaveAttribute('aria-expanded', 'false'))
    fireEvent.click(docBtn)
    expect(await screen.findByDisplayValue('INV-001')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Lines/ }))
    expect(await screen.findByDisplayValue('1,000.00')).toBeInTheDocument()
  })

  it('tells the reviewer when the document is no longer theirs to handle', async () => {
    vi.mocked(api.getPending).mockRejectedValue(new Error('404'))
    mount()
    expect(await screen.findByText('This document is not waiting for review')).toBeInTheDocument()
  })
})

describe('which sections open themselves', () => {
  it('leaves a clean document fully collapsed', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByText('Document')
    // Nothing may open even for a frame: the GL verdict arrives async, and opening on its
    // pessimistic default flashed the section open and shut on every clean document.
    await screen.findByTestId('accounting')
    for (let i = 0; i < 5; i++) {
      const flags = Array.from(document.querySelectorAll('.rd-section-btn')).map(b =>
        b.getAttribute('aria-expanded')
      )
      expect(flags).toEqual(['false', 'false', 'false', 'false'])
      await new Promise(r => setTimeout(r, 10))
    }
  })

  it('opens the section whose header states a problem', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail({ extracted: { ...EXTRACTED, doc_no: '' } }))
    mount()
    const doc = await screen.findByRole('button', { name: /Document number is missing/ })
    // The section opens from an effect, which commits after findBy* first sees the button.
    await waitFor(() => expect(doc).toHaveAttribute('aria-expanded', 'true'))
    expect(screen.getByRole('button', { name: /Lines/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens Lines when a line does not add up', async () => {
    vi.mocked(api.getPending).mockResolvedValue(
      detail({
        extracted: {
          ...EXTRACTED,
          details: [
            {
              transaction: 'Visa',
              pay_amt: '1000.00',
              commis_amt: '30.00',
              tax_amt: '2.10',
              total: '900.00',
            },
          ],
        },
      })
    )
    mount()
    const lines = await screen.findByRole('button', { name: /Line 1 does not add up/ })
    await waitFor(() => expect(lines).toHaveAttribute('aria-expanded', 'true'))
  })
})

describe('approving', () => {
  it('posts the edited values, not the ones that arrived', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-9001', tax_note: null })
    mount()
    const docBtn = await screen.findByRole('button', { name: /Document/ })
    await waitFor(() => expect(docBtn).toHaveAttribute('aria-expanded', 'false'))
    fireEvent.click(docBtn)
    const docNo = await screen.findByDisplayValue('INV-001')
    fireEvent.change(docNo, { target: { value: 'INV-999' } })
    await clickApprove()

    await waitFor(() => expect(api.approveDocument).toHaveBeenCalled())
    const body = vi.mocked(api.approveDocument).mock.calls[0][1]
    expect((body.extracted as Record<string, unknown>).doc_no).toBe('INV-999')
    expect(body.post_input_tax).toBe(true)
  })

  it('cannot be approved while the JV would not balance', async () => {
    // Exactly what AccountingReview already refuses to submit — the page must not offer
    // a way around its own rule.
    accState = { rows: [], blocked: true, unmappedFields: [] } as unknown as AccountingState
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    expect(await screen.findByRole('button', { name: /Approve and post/ })).toBeDisabled()
  })

  it('keeps the document on screen when Carmen refuses it', async () => {
    // The one place a failed post is not terminal: a closed period or an unknown dept
    // code is something the person standing here can fix and try again.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockRejectedValue(new Error('Period is closed'))
    mount()
    await clickApprove()
    expect(await screen.findByText('Period is closed')).toBeInTheDocument()
    expect(window.location.hash).toContain('review')
  })

  it('sends the reviewer back to the queue when someone else got there first', async () => {
    const err = new Error('Someone else has already handled this document') as Error & {
      status?: number
    }
    err.status = 409
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockRejectedValue(err)
    mount()
    await clickApprove()
    await waitFor(() => expect(window.location.hash).toBe('#/CreditCardOCR'))
  })

  it('can decline the input-tax record without blocking the JV', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-2', tax_note: null })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /Input tax/ }))
    fireEvent.click(screen.getByRole('checkbox'))
    await clickApprove()
    await waitFor(() => expect(api.approveDocument).toHaveBeenCalled())
    expect(vi.mocked(api.approveDocument).mock.calls[0][1].post_input_tax).toBe(false)
  })
})

describe('rejecting', () => {
  it('asks first, and says the charge is not coming back', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^Reject$/ }))
    expect(await screen.findByText(/does not refund it/)).toBeInTheDocument()
  })

  it('sends the optional reason and returns to the queue', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.rejectDocument).mockResolvedValue(undefined)
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^Reject$/ }))
    fireEvent.change(await screen.findByLabelText(/Reason/), {
      target: { value: '  wrong company  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Reject document/ }))
    await waitFor(() => expect(api.rejectDocument).toHaveBeenCalledWith('d1', 'wrong company'))
    await waitFor(() => expect(window.location.hash).toBe('#/CreditCardOCR'))
  })
})
