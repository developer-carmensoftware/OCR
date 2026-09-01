import type React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import ReviewQueue from './ReviewQueue'
import type { ReviewDocument, ReviewStatus } from '../lib/api/emailReview'

vi.mock('../lib/api/emailReview', async importOriginal => ({
  // ACTIVITY_FILTERS is data the page iterates, not a call to stub.
  ...(await importOriginal<typeof import('../lib/api/emailReview')>()),
  listActivity: vi.fn(),
  getReviewStatus: vi.fn(),
  setAutoPost: vi.fn(),
}))
// The chrome needs AuthProvider and pulls credits over the network. Neither has anything
// to do with which of its states this page picks, which is what these tests are about.
vi.mock('../components/common/UsageIndicator', () => ({ default: () => null }))
vi.mock('../components/common/AppHeader', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <header>{children}</header>,
}))

const api = await import('../lib/api/emailReview')

function doc(over: Partial<ReviewDocument> = {}): ReviewDocument {
  return {
    id: 'd1',
    source: 'email',
    created_at: '2026-08-28T00:00:00Z',
    attachment: 'july.pdf',
    bank_code: 'KTC',
    doc_no: 'INV-001',
    status: 'pending_review',
    doc_date: '15/01/2026',
    total: 48200,
    line_count: 14,
    flags: [],
    unmapped: [],
    guessed: [],
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
    ...over,
  }
}

const ZERO = { all: 0, review: 0, success: 0, failed: 0, skipped: 0 }

function mount(
  s: ReviewStatus,
  rows: ReviewDocument[],
  counts: Record<string, number> = { ...ZERO, all: rows.length, review: rows.length },
  total = rows.length
) {
  vi.mocked(api.getReviewStatus).mockResolvedValue(s)
  vi.mocked(api.listActivity).mockResolvedValue({
    total,
    limit: 25,
    offset: 0,
    data: rows,
    counts,
  })
  return render(
    <LanguageProvider>
      <ReviewQueue />
    </LanguageProvider>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('which state the automation page paints', () => {
  it('lists what is waiting, with the gross amount the reviewer is agreeing to', async () => {
    mount(status(), [doc()])
    expect(await screen.findByText('KTC')).toBeInTheDocument()
    expect(screen.getByText('INV-001')).toBeInTheDocument()
    expect(screen.getByText('48,200.00')).toBeInTheDocument()
    expect(screen.getByText('1 waiting for you')).toBeInTheDocument()
  })

  it('reads as success, not absence, when a live BU is caught up', async () => {
    mount(status(), [], ZERO)
    expect(await screen.findByText('You are all caught up')).toBeInTheDocument()
    // Never the sales pitch: this BU already knows what the feature is.
    expect(screen.queryByText('Let statements post themselves')).not.toBeInTheDocument()
  })

  it('sells the feature to a BU that has not switched it on', async () => {
    mount(status({ enabled: false, blockers: ['disabled'] }), [], ZERO)
    expect(await screen.findByText('Let statements post themselves')).toBeInTheDocument()
    expect(screen.getByText('AIAGENT+ab12@carmensoftware.com')).toBeInTheDocument()
    expect(screen.getByText('Forwarding is switched off right now.')).toBeInTheDocument()
  })

  it('hides the address from a BU that cannot receive mail yet', async () => {
    // An address that silently drops everything sent to it is worse than no address.
    mount(status({ enabled: false, entitled: false, blockers: ['not_entitled'] }), [], ZERO)
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
    vi.mocked(api.listActivity).mockRejectedValue(new Error('offline'))
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
    mount(status({ auto_post: true }), [], ZERO)
    await waitFor(() => expect(screen.getByText('Posting without review')).toBeInTheDocument())
  })
})

describe('the message column', () => {
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

describe('the source column', () => {
  it('tells a forwarded document apart from one somebody scanned', async () => {
    mount(status(), [
      doc({ id: 'a' }),
      doc({ id: 'b', source: 'manual', status: 'posted', jv_no: 'JV-7', total: 0 }),
    ])
    expect(await screen.findByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.getByText('scanned and posted by hand')).toBeInTheDocument()
  })
})

describe('the status filter chips', () => {
  it('offers one chip per status group, each with its count', async () => {
    mount(status(), [doc()], { all: 113, review: 3, success: 7, failed: 2, skipped: 101 })
    for (const [label, n] of [
      ['All', '113'],
      ['Needs review', '3'],
      ['Posted', '7'],
      ['Not posted', '2'],
      ['Skipped', '101'],
    ]) {
      const chip = await screen.findByRole('tab', { name: new RegExp(label) })
      expect(chip).toHaveTextContent(n)
    }
  })

  it('shows a zero rather than dropping the chip', async () => {
    // A count that disappears makes the strip reflow as documents resolve, and "0" is
    // itself the answer to "did anything fail?".
    mount(status(), [doc()])
    const chip = await screen.findByRole('tab', { name: /Not posted/ })
    expect(chip).toHaveTextContent('0')
  })

  it('refetches for the chip that was clicked', async () => {
    mount(status(), [doc()], { ...ZERO, all: 5, review: 1, success: 4 })
    fireEvent.click(await screen.findByRole('tab', { name: /Posted/ }))
    await waitFor(() => {
      const calls = vi.mocked(api.listActivity).mock.calls
      expect(calls[calls.length - 1][0]).toBe('success')
    })
  })

  it('refetches only the list when the view moves — status is configuration', async () => {
    // Changing chip or page used to cost two round trips, one of which could not
    // possibly return anything new. Status only refetches on an explicit refresh.
    mount(status(), [doc()], { ...ZERO, all: 5, review: 1, success: 4 })
    await screen.findByRole('tab', { name: /Posted/ })
    expect(vi.mocked(api.getReviewStatus)).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: /Posted/ }))
    await waitFor(() => expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.getReviewStatus)).toHaveBeenCalledTimes(1)
  })

  it('hides the chips from a BU with no documents at all', async () => {
    // Five zeroes above an explanation of what the feature is would be scaffolding,
    // not navigation.
    mount(status({ enabled: false, blockers: ['disabled'] }), [], ZERO)
    await screen.findByText('Let statements post themselves')
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('never claims "all caught up" on an empty Posted chip', async () => {
    // Nothing has posted yet is a different statement from you are up to date, and must
    // not borrow its tick.
    mount(status(), [], { ...ZERO, all: 2, failed: 2 })
    fireEvent.click(await screen.findByRole('tab', { name: /Posted/ }))
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument()
    expect(screen.queryByText('You are all caught up')).not.toBeInTheDocument()
  })
})

describe('the actions column', () => {
  it('offers Review only on a document that is actually waiting', async () => {
    mount(status(), [doc()])
    expect(await screen.findByRole('button', { name: 'Review' })).toBeInTheDocument()
  })

  it('offers nothing on a resolved row', async () => {
    // A posted document has no review_payload left — `_finish` clears it — so a button
    // there would open nothing. Its JV number is the link instead.
    mount(status(), [doc({ status: 'posted', jv_no: 'JV-9001', total: 0 })])
    await screen.findByText('JV-9001')
    expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument()
  })

  it('sends a missing GL mapping to the screen that fixes it', async () => {
    mount(status(), [doc({ status: 'failed', reason_code: 'mapping_incomplete', total: 0 })])
    const link = await screen.findByRole('link', { name: 'Fix mapping' })
    expect(link).toHaveAttribute('href', '#/CreditCardOCR/mapping')
  })

  // The regression that matters: the ledger's skipped/failed split is about whether a
  // credit was charged, NOT about whether anyone can act. Keying the action off `status`
  // hides every one of these behind the chip the design doc calls "mostly noise" — which
  // is how eight sender_not_allowed rows cost a day of diagnosis on 2026-08-28.
  it.each(['no_rule_match', 'sender_not_allowed', 'wrong_pdf_password', 'ingest_paused'])(
    'offers settings on a *skipped* %s row',
    async reason_code => {
      mount(status(), [doc({ status: 'skipped', reason_code, total: 0 })])
      const link = await screen.findByRole('link', { name: 'Open settings' })
      expect(link).toHaveAttribute('href', '#/email-settings')
    }
  )

  it('gives a dead Carmen credential its own word, not a generic settings link', async () => {
    // One expired token fails EVERY document of the BU until someone re-pastes it, so it
    // is not "a setting is off" — it is "the pipeline is down".
    mount(status(), [doc({ status: 'failed', reason_code: 'carmen_unauthorized', total: 0 })])
    expect(await screen.findByRole('link', { name: 'Reconnect Carmen' })).toBeInTheDocument()
    expect(screen.getByText(/Carmen connection has expired/)).toBeInTheDocument()
  })

  it.each(['carmen_rejected', 'duplicate_document', 'unreadable_document'])(
    'offers nothing on %s, where a button would be a lie',
    async reason_code => {
      mount(status(), [doc({ status: 'failed', reason_code, total: 0 })])
      await screen.findByRole('table')
      expect(screen.queryByRole('link', { name: /settings|mapping|Reconnect/ })).toBeNull()
    }
  )
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

  it('opens the JV in Carmen', async () => {
    // Same destination the `document_posted` notification offers, from the same helper.
    mount(status(), [doc({ status: 'posted', jv_no: 'JV-1', total: 0 })])
    const link = await screen.findByRole('link', { name: /JV-1/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('/glJv/JV-1/show'))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('leaves a row with nothing to open inert', async () => {
    // A failed document has no JV and no payload: there is nowhere to click, so there is
    // no affordance offering one.
    mount(status(), [doc({ status: 'failed', reason_code: 'carmen_rejected', jv_no: null })])
    await screen.findByText(/Carmen refused it/)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
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
    mount(status({ enabled: false, blockers: ['disabled'] }), [], ZERO)
    await screen.findByText('Let statements post themselves')
    expect(screen.queryByRole('button', { name: /Automation settings/ })).not.toBeInTheDocument()
  })
})
