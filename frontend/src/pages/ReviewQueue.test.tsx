import type React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import ReviewQueue from './ReviewQueue'
import type { ReviewDocument, ReviewStatus } from '../lib/api/emailReview'

vi.mock('../lib/api/emailReview', async importOriginal => ({
  // QUEUE_TABS is data the page iterates, not a call to stub.
  ...(await importOriginal<typeof import('../lib/api/emailReview')>()),
  listDocuments: vi.fn(),
  getReviewStatus: vi.fn(),
  setAutoPost: vi.fn(),
}))
// The chrome needs AuthProvider and pulls credits over the network. Neither has anything
// to do with which of its four states this page picks, which is all these tests are about.
vi.mock('../components/common/UsageIndicator', () => ({ default: () => null }))
vi.mock('../components/common/AppHeader', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <header>{children}</header>,
}))

const api = await import('../lib/api/emailReview')

function doc(over: Partial<ReviewDocument> = {}): ReviewDocument {
  return {
    id: 'd1',
    created_at: '2026-08-28T00:00:00Z',
    attachment: 'july.pdf',
    bank_code: 'KTC',
    doc_no: 'INV-001',
    status: 'pending_review',
    doc_date: '15/01/2026',
    total: 48200,
    line_count: 14,
    flags: [],
    jv_no: null,
    reason_code: null,
    error_message: null,
    reviewed_by_name: null,
    reviewed_at: null,
    ...over,
  }
}

function status(over: Partial<ReviewStatus> = {}): ReviewStatus {
  return {
    enabled: true,
    auto_post: false,
    entitled: true,
    ingest_address: 'AIAGENT+ab12@carmensoftware.com',
    blockers: [],
    counts: { review: 0, posted: 0, problem: 0, skipped: 0 },
    ...over,
  }
}

function mount(s: ReviewStatus, rows: ReviewDocument[], total = rows.length) {
  vi.mocked(api.getReviewStatus).mockResolvedValue(s)
  vi.mocked(api.listDocuments).mockResolvedValue({ total, limit: 25, offset: 0, data: rows })
  return render(
    <LanguageProvider>
      <ReviewQueue />
    </LanguageProvider>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('which state the automation page paints', () => {
  it('lists what is waiting, with the gross amount the reviewer is agreeing to', async () => {
    mount(status({ counts: { review: 1, posted: 0, problem: 0, skipped: 0 } }), [doc()])
    expect(await screen.findByText('KTC')).toBeInTheDocument()
    expect(screen.getByText('INV-001')).toBeInTheDocument()
    expect(screen.getByText('48,200.00')).toBeInTheDocument()
    expect(screen.getByText('1 waiting for you')).toBeInTheDocument()
  })

  it('reads as success, not absence, when a live BU is caught up', async () => {
    mount(status(), [])
    expect(await screen.findByText('You are all caught up')).toBeInTheDocument()
    // Never the sales pitch: this BU already knows what the feature is.
    expect(screen.queryByText('Let statements post themselves')).not.toBeInTheDocument()
  })

  it('sells the feature to a BU that has not switched it on', async () => {
    mount(status({ enabled: false, blockers: ['disabled'] }), [])
    expect(await screen.findByText('Let statements post themselves')).toBeInTheDocument()
    expect(screen.getByText('AIAGENT+ab12@carmensoftware.com')).toBeInTheDocument()
    expect(screen.getByText('Forwarding is switched off right now.')).toBeInTheDocument()
  })

  it('hides the address from a BU that cannot receive mail yet', async () => {
    // An address that silently drops everything sent to it is worse than no address.
    mount(status({ enabled: false, entitled: false, blockers: ['not_entitled'] }), [])
    await screen.findByText('Let statements post themselves')
    expect(screen.queryByText('AIAGENT+ab12@carmensoftware.com')).not.toBeInTheDocument()
    expect(
      screen.getByText('An active package is needed before an address can be issued.')
    ).toBeInTheDocument()
  })

  it('never shows an empty state when the fetch failed', async () => {
    // "Nothing is waiting" and "we could not ask" mean opposite things to someone
    // deciding whether to go home.
    vi.mocked(api.getReviewStatus).mockRejectedValue(new Error('offline'))
    vi.mocked(api.listDocuments).mockRejectedValue(new Error('offline'))
    render(
      <LanguageProvider>
        <ReviewQueue />
      </LanguageProvider>
    )
    expect(await screen.findByText('Could not load the queue')).toBeInTheDocument()
    expect(screen.queryByText('You are all caught up')).not.toBeInTheDocument()
    expect(screen.queryByText('Let statements post themselves')).not.toBeInTheDocument()
  })

  it('says so when the BU has turned review off', async () => {
    mount(status({ auto_post: true }), [])
    await waitFor(() => expect(screen.getByText('Posting without review')).toBeInTheDocument())
  })
})

describe('the reason line', () => {
  const cases: [ReviewDocument['flags'], string][] = [
    [['unbalanced'], 'amounts do not reconcile'],
    [['mapping_guessed'], 'GL mapping guessed'],
    [['warnings'], 'extraction warnings'],
    [[], 'nothing flagged'],
  ]

  it.each(cases)('renders %s as "%s"', async (flags, text) => {
    mount(status(), [doc({ flags })])
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('shows only the most blocking reason, never a list', async () => {
    // Ordered by how much it should stop someone: an unbalanced JV cannot post at all,
    // a guessed mapping posts but may post to the wrong account.
    mount(status(), [doc({ flags: ['warnings', 'mapping_guessed', 'unbalanced'] })])
    expect(await screen.findByText('amounts do not reconcile')).toBeInTheDocument()
    expect(screen.queryByText('GL mapping guessed')).not.toBeInTheDocument()
    expect(screen.queryByText('extraction warnings')).not.toBeInTheDocument()
  })
})

describe('the status tabs', () => {
  it('offers one tab per status group, each with its count', async () => {
    mount(status({ counts: { review: 3, posted: 7, problem: 2, skipped: 101 } }), [doc()])
    for (const [label, n] of [
      ['Needs review', '3'],
      ['Posted', '7'],
      ['Not posted', '2'],
      ['Skipped', '101'],
    ]) {
      const tab = await screen.findByRole('tab', { name: new RegExp(label) })
      expect(tab).toHaveTextContent(n)
    }
  })

  it('shows a zero rather than dropping the tab', async () => {
    // A count that disappears makes the strip reflow as documents resolve, and "0" is
    // itself the answer to "did anything fail?".
    mount(status(), [doc()])
    const tab = await screen.findByRole('tab', { name: /Not posted/ })
    expect(tab).toHaveTextContent('0')
  })

  it('refetches for the tab that was clicked', async () => {
    mount(status({ counts: { review: 1, posted: 4, problem: 0, skipped: 0 } }), [doc()])
    fireEvent.click(await screen.findByRole('tab', { name: /Posted/ }))
    await waitFor(() => {
      const calls = vi.mocked(api.listDocuments).mock.calls
      expect(calls[calls.length - 1][0]).toBe('posted')
    })
  })

  it('hides the tabs from a BU with no mail at all', async () => {
    // Four zeroes above an explanation of what the feature is would be scaffolding,
    // not navigation.
    mount(status({ enabled: false, blockers: ['disabled'] }), [])
    await screen.findByText('Let statements post themselves')
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('never claims "all caught up" on an empty Posted tab', async () => {
    // Nothing has posted yet is a different statement from you are up to date, and must
    // not borrow its tick.
    mount(status({ counts: { review: 0, posted: 0, problem: 0, skipped: 0 } }), [])
    fireEvent.click(await screen.findByRole('tab', { name: /Posted/ }))
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument()
    expect(screen.queryByText('You are all caught up')).not.toBeInTheDocument()
  })
})

describe('a row that has already been resolved', () => {
  it('shows the JV it became and who posted it, never a zero amount', async () => {
    // `_finish` clears review_payload on every terminal transition, so total/date/lines
    // are gone. Rendering 0.00 would be a wrong number, not a missing one.
    mount(status(), [
      doc({
        status: 'posted',
        total: 0,
        line_count: 0,
        doc_date: null,
        jv_no: 'JV-9001',
        reviewed_by_name: 'somchai',
      }),
    ])
    expect(await screen.findByText('JV-9001')).toBeInTheDocument()
    expect(screen.getByText(/posted by somchai/)).toBeInTheDocument()
    expect(screen.queryByText('0.00')).not.toBeInTheDocument()
  })

  it('translates the reason a document did not post', async () => {
    mount(status(), [doc({ status: 'failed', reason_code: 'carmen_rejected', total: 0 })])
    expect(await screen.findByText(/Carmen refused it/)).toBeInTheDocument()
  })

  it('falls back to the raw reason code rather than showing nothing', async () => {
    // An unfamiliar code is still a lead; a blank is not.
    mount(status(), [doc({ status: 'failed', reason_code: 'something_new', total: 0 })])
    expect(await screen.findByText('something_new')).toBeInTheDocument()
  })

  it('is not clickable — there is nothing left to open', async () => {
    mount(status(), [doc({ status: 'posted', jv_no: 'JV-1' })])
    await screen.findByText('JV-1')
    expect(screen.queryByRole('button', { name: /KTC/ })).not.toBeInTheDocument()
  })
})

describe('the auto-post switch', () => {
  it('is behind the gear, not on the queue', async () => {
    // Turning review off is decided once, after weeks of watching. Offering it beside the
    // documents would put it in front of someone whose job today is approving one.
    mount(status(), [doc()])
    await screen.findByText('KTC')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Automation settings/ }))
    expect(await screen.findByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('saves the flip and re-reads the status rather than trusting itself', async () => {
    vi.mocked(api.setAutoPost).mockResolvedValue(true)
    mount(status(), [doc()])
    await screen.findByText('KTC')
    fireEvent.click(screen.getByRole('button', { name: /Automation settings/ }))
    fireEvent.click(await screen.findByRole('switch'))
    await waitFor(() => expect(api.setAutoPost).toHaveBeenCalledWith(true))
    // The badge in the bar reads the fetched status, so the page has to ask again.
    await waitFor(() => expect(vi.mocked(api.getReviewStatus).mock.calls.length).toBeGreaterThan(1))
  })

  it('leaves the switch where it was when the save fails', async () => {
    // The screen must not claim a setting that the server never took.
    vi.mocked(api.setAutoPost).mockRejectedValue(new Error('offline'))
    mount(status(), [doc()])
    await screen.findByText('KTC')
    fireEvent.click(screen.getByRole('button', { name: /Automation settings/ }))
    fireEvent.click(await screen.findByRole('switch'))
    await waitFor(() => expect(api.setAutoPost).toHaveBeenCalled())
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('is not offered to a BU with nothing forwarding', async () => {
    mount(status({ enabled: false, blockers: ['disabled'] }), [])
    await screen.findByText('Let statements post themselves')
    expect(screen.queryByRole('button', { name: /Automation settings/ })).not.toBeInTheDocument()
  })
})
