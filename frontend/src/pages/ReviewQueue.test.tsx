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
  // Unstubbed this reaches apiFetch in jsdom. The hook fires it whenever the chip on
  // screen is holding something nobody has looked at.
  markChipSeen: vi.fn(),
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
    posted_by_name: null,
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

const ZERO = { all: 0, review: 0, success: 0, unposted: 0 }

function mount(
  s: ReviewStatus,
  rows: ReviewDocument[],
  counts: Record<string, number> = { ...ZERO, all: rows.length, review: rows.length },
  total = rows.length,
  attention: Record<string, number> = ZERO,
  // Which chips are holding something unlooked-at — what actually draws the dot.
  unseen: Record<string, boolean> = {}
) {
  vi.mocked(api.getReviewStatus).mockResolvedValue(s)
  vi.mocked(api.listActivity).mockResolvedValue({
    total,
    limit: 25,
    offset: 0,
    data: rows,
    counts,
    attention,
    unseen,
  })
  return render(
    <LanguageProvider>
      <ReviewQueue />
    </LanguageProvider>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('which state the automation page paints', () => {
  it('lists what is waiting, and leaves the amount to the document', async () => {
    // The gross used to be appended to the filename on the second line of this cell. It is
    // a figure a reviewer decides on, and deciding happens in the dialog, where it sits in
    // the JV's own total row beside the legs it is made of.
    mount(status(), [doc()])
    expect(await screen.findByText('KTC')).toBeInTheDocument()
    expect(screen.getByText('INV-001')).toBeInTheDocument()
    expect(screen.getByText('july.pdf')).toBeInTheDocument()
    expect(screen.queryByText('48,200.00')).not.toBeInTheDocument()
  })

  it('has no heading — the chip strip is it', async () => {
    // "1 waiting for you" printed the number the Review chip already carries two
    // rows below, and had nothing true to say to a BU that posts without review.
    mount(status(), [doc()])
    await screen.findByText('KTC')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('tab', { name: /Review/ })).toHaveTextContent('1'))
  })

  it('shows each row the bank that issued it, not one bank for the whole page', async () => {
    // The reported bug, at the surface where it was reported. Four documents, four
    // issuers: the page must not collapse them onto whichever rule matched the filenames.
    mount(status(), [
      doc({ id: 'a', bank_code: 'KTC', doc_no: 'INV-1', attachment: 'MDR-july.pdf' }),
      doc({ id: 'b', bank_code: 'BAY', doc_no: 'INV-2', attachment: 'krungsri-july.pdf' }),
      doc({ id: 'c', bank_code: 'PAYPAL', doc_no: 'INV-3', attachment: 'scan0012.pdf' }),
      doc({ id: 'd', bank_code: 'KBANK', doc_no: 'INV-4', attachment: 'kbank-july.pdf' }),
    ])
    for (const code of ['KTC', 'BAY', 'PAYPAL', 'KBANK']) {
      expect(await screen.findByText(code)).toBeInTheDocument()
    }
  })

  it('says so plainly when ingest could not identify the issuer', async () => {
    // A null bank is an honest answer — the fallback must read as "unknown", never as
    // some default bank the reader would then trust.
    mount(status(), [doc({ bank_code: null })])
    expect(await screen.findByText('Unknown')).toBeInTheDocument()
  })

  it('reads as success, not absence, when a live BU is caught up', async () => {
    mount(status(), [], ZERO)
    // ZERO leaves every chip empty, so the fall-through stays on Today.
    expect(await screen.findByText('No activity today')).toBeInTheDocument()
    // Never the sales pitch: this BU already knows what the feature is.
    expect(screen.queryByText('Let statements post themselves')).not.toBeInTheDocument()
  })

  it('never prints the ingest address on a chip that is merely empty', async () => {
    // It used to sit mid-sentence here, unbreakable and unspaced, while the not-set-up
    // screen gave the same string a mono field and a copy button. One of those is a
    // product surface; the other is a debug line.
    mount(status(), [], ZERO)
    await screen.findByText('No activity today')
    expect(screen.queryByText(/carmensoftware\.com/)).not.toBeInTheDocument()
  })

  it('says the same true thing whether or not the BU reviews before posting', async () => {
    // "…land here for approval before they post" described, to a BU that had switched
    // review off, the exact thing it had stopped doing. No empty state on this page may
    // name forwarding or approval, because either can be switched off under it.
    mount(status({ auto_post: true }), [], ZERO)
    expect(await screen.findByText(/appear here/)).toBeInTheDocument()
    expect(screen.queryByText(/approval/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/forward/i)).not.toBeInTheDocument()
  })

  it('sells the feature to a BU that has not switched it on', async () => {
    mount(status({ enabled: false, blockers: ['disabled'] }), [], ZERO)
    expect(await screen.findByText('Let statements post themselves')).toBeInTheDocument()
    expect(screen.getByText('AIAGENT+ab12@carmensoftware.com')).toBeInTheDocument()
    expect(screen.getByText('AI JV Automation is switched off right now.')).toBeInTheDocument()
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
    expect(screen.queryByText('No activity today')).not.toBeInTheDocument()
    expect(screen.queryByText('Let statements post themselves')).not.toBeInTheDocument()
  })
})

describe('the message column', () => {
  const cases: [ReviewDocument['flags'], string][] = [
    [['unbalanced'], 'Amounts do not reconcile'],
    [['mapping_guessed'], 'AI suggested mapping'],
    [['doc_no_missing'], 'No document number'],
    [['warnings'], 'Extraction warnings'],
    // Also the auto-post rule: an empty flag list is what posts unattended, so this phrase
    // and that decision are the same test read two ways.
    [[], 'Ready to post'],
  ]

  it.each(cases)('renders %s as "%s"', async (flags, text) => {
    mount(status(), [doc({ flags })])
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('shows only the most blocking reason, never a list', async () => {
    // Ordered by how much it should stop someone: an unbalanced JV cannot post at all,
    // a guessed mapping posts but may post to the wrong account.
    mount(status(), [
      doc({ flags: ['warnings', 'doc_no_missing', 'mapping_guessed', 'unbalanced'] }),
    ])
    expect(await screen.findByText('Amounts do not reconcile')).toBeInTheDocument()
    expect(screen.queryByText('AI suggested mapping')).not.toBeInTheDocument()
    expect(screen.queryByText('No document number')).not.toBeInTheDocument()
    expect(screen.queryByText('Extraction warnings')).not.toBeInTheDocument()
  })

  it('says why the pipeline stopped, over anything it merely noticed', async () => {
    // A pending row can now carry a reason code: a refusal that came after a paid-for
    // extraction parks rather than finishing. "Why this got no further" is a stronger claim
    // on the reviewer's time than "why this might be worth opening".
    mount(status(), [doc({ reason_code: 'tax_id_mismatch', flags: ['unbalanced'] })])
    expect(await screen.findByText(/tax ID/i)).toBeInTheDocument()
    expect(screen.queryByText('Amounts do not reconcile')).not.toBeInTheDocument()
  })

  it("prints Carmen's own verdict on the row that can still act on it", async () => {
    // The same `stopText` a resolved row uses. Printing the phrase alone here put the
    // verdict on the dead row and hid it on the live one, which is backwards: this document
    // is still open, still editable and still postable.
    mount(status(), [
      doc({
        reason_code: 'carmen_rejected',
        error_message: 'Carmen: Period 2026-08 is closed',
      }),
    ])
    expect(await screen.findByText('Carmen: Period 2026-08 is closed')).toBeInTheDocument()
    expect(screen.queryByText('Carmen refused it')).not.toBeInTheDocument()
  })

  it('still offers Review on a row that stopped, because it is still postable', async () => {
    // The whole point of parking it: the reading was paid for, so the document is editable
    // and postable rather than being a record of a failure.
    mount(status(), [doc({ reason_code: 'carmen_rejected' })])
    expect(await screen.findByRole('button', { name: 'Review' })).toBeInTheDocument()
  })
})

describe('a skipped attachment on Not posted', () => {
  const skipped = (over: Partial<ReviewDocument> = {}) =>
    doc({ status: 'skipped', reason_code: 'wrong_pdf_password', flags: [], total: 0, ...over })

  /** Land on Not posted — the page opens on `today` and falls through only to `review`
   *  then `success`, so the chip has to be clicked. */
  const onUnposted = async (rows: ReviewDocument[]) => {
    mount(status(), rows, { ...ZERO, all: rows.length, unposted: rows.length }, rows.length)
    fireEvent.click(await screen.findByRole('tab', { name: /Not posted/ }))
    await waitFor(() => expect(api.listActivity).toHaveBeenCalledTimes(2))
  }

  it('reads exactly like the same row does under All', async () => {
    // One row per attachment, its own filename in the Document cell, its reason in the
    // Detail cell. The pre-charge refusals were briefly folded into one row per cause with
    // the filenames underneath; that came out again — §18 #86.
    await onUnposted([skipped()])
    expect(await screen.findByText('july.pdf')).toBeInTheDocument()
    expect(screen.getByText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open settings' })).toHaveAttribute(
      'href',
      '#/email-settings'
    )
  })

  it('carries no summary row and nothing to expand', async () => {
    await onUnposted([skipped({ id: 'a' }), skipped({ id: 'b', attachment: 'aug.pdf' })])
    await screen.findByText('aug.pdf')
    expect(screen.queryByText(/attachments/)).not.toBeInTheDocument()
    expect(screen.getByRole('table').querySelector('[aria-expanded]')).toBeNull()
    // Two rows, one request — nothing fetches a second page to fill a disclosure.
    expect(api.listActivity).toHaveBeenCalledTimes(2)
  })

  it('offers no repair where pressing one would be a lie', async () => {
    // `unsupported_attachment` has no FIX entry: the bytes are never stored, so there is
    // nothing to re-read and no setting that changes it (§13 #26).
    await onUnposted([skipped({ reason_code: 'unsupported_attachment' })])
    await screen.findByText('july.pdf')
    expect(screen.queryByRole('link', { name: 'Open settings' })).not.toBeInTheDocument()
  })
})

describe('what a stopped row offers', () => {
  const skipped = () =>
    doc({ status: 'skipped', reason_code: 'wrong_pdf_password', flags: [], total: 0 })

  it('points a skipped row at the setting on whatever chip it is on', async () => {
    // #81 kept this cell empty off the Review chip on two grounds and §18 removed both: the
    // row is no longer duplicated onto `review`, and a fixable reason off that chip no
    // longer implies somebody dismissed it.
    mount(status(), [skipped()], { ...ZERO, all: 1, unposted: 1 })
    fireEvent.click(await screen.findByRole('tab', { name: /Not posted/ }))
    await waitFor(() => expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('link', { name: 'Open settings' })).toHaveAttribute(
      'href',
      '#/email-settings'
    )
  })

  it('never offers a repair on a document waiting for review', async () => {
    // Review is the stronger action, and it is where the reviewer reads the reason.
    mount(status(), [doc()], { ...ZERO, all: 1, review: 1 })
    await screen.findByRole('button', { name: 'Review' })
    expect(screen.queryByRole('link', { name: 'Open settings' })).not.toBeInTheDocument()
  })
})

describe('where a row came from', () => {
  it('says it in the message, and nowhere else', async () => {
    // Not a column, and no longer an icon either. A manual scan is only ever listed once
    // posted, so outside the Posted chip both said the same word on every row — and inside
    // it, this sentence was already saying it.
    mount(status(), [
      doc({ id: 'a' }),
      doc({ id: 'b', source: 'manual', status: 'posted', jv_no: 'JV-7', total: 0 }),
    ])
    expect(await screen.findByText('Scanned and posted by hand')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Source' })).not.toBeInTheDocument()
    expect(screen.queryByText('Email')).not.toBeInTheDocument()
    expect(screen.queryByText('Manual')).not.toBeInTheDocument()
  })

  it('names whoever ran a manual scan', async () => {
    // "by hand" answered how, which the Source glyph already says; the name answers who,
    // which is what the reader opened the row for.
    mount(status(), [
      doc({
        source: 'manual',
        status: 'posted',
        jv_no: 'JV-7',
        total: 0,
        posted_by_name: 'somchai',
      }),
    ])
    expect(await screen.findByText('Scanned and posted by somchai')).toBeInTheDocument()
    expect(screen.queryByText('Scanned and posted by hand')).not.toBeInTheDocument()
  })

  it('falls back to "by hand" when the scanner can no longer be resolved', async () => {
    // The name comes from the session that ran the scan, not from a stored column, so it
    // really can be gone. The vaguer sentence beats printing a raw user id at somebody.
    mount(status(), [doc({ source: 'manual', status: 'posted', jv_no: 'JV-7', total: 0 })])
    expect(await screen.findByText('Scanned and posted by hand')).toBeInTheDocument()
  })

  it('leads with the status, not the source', async () => {
    // The pill is what distinguishes one row from the next once the statuses are mixed;
    // it used to sit fifth, behind two columns of mostly em dashes.
    mount(status(), [doc()])
    await screen.findByText('KTC')
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent)
    expect(headers).toEqual(['Status', 'Document', 'Detail', 'Received', 'JV no.', 'Actions'])
  })

  it('puts the width classes on the header cells, which is what fixed layout measures', async () => {
    // The regression this exists for: `table-layout: fixed` reads column widths from the
    // first row only. While `.rq-c-*` lived solely on the body <td>s the widths in
    // review-queue.css did nothing and all six columns rendered at an equal 1/6, which is
    // what starved Document and Message. jsdom cannot measure a width; the class on the
    // <th> is the thing whose absence caused it.
    mount(status(), [doc()])
    await screen.findByText('KTC')
    for (const [name, cls] of [
      ['Status', 'rq-c-status'],
      ['Document', 'rq-c-doc'],
      ['Detail', 'rq-c-msg'],
      ['Received', 'rq-c-when'],
      ['JV no.', 'rq-c-jv'],
      ['Actions', 'rq-c-act'],
    ]) {
      expect(screen.getByRole('columnheader', { name })).toHaveClass(cls)
    }
  })
})

describe('the JV number', () => {
  it('opens from the Actions column, not by clicking the number', async () => {
    // The number itself used to be the link, which made the one thing a reviewer wants to
    // do with it — select it and paste it into Carmen's own search — impossible.
    mount(status(), [doc({ id: 'b', status: 'posted', jv_no: 'JV-7', total: 0 })])
    const link = await screen.findByRole('link', { name: /Open JV/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('/glJv/JV-7/show'))
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByText('JV-7').closest('a')).toBeNull()
  })

  it('offers no button for a row posted before jv_no was recorded', async () => {
    // credit_cards.jv_no is NULL for anything posted before migration 20260831000000.
    mount(status(), [doc({ id: 'c', status: 'posted', jv_no: null, total: 0 })])
    await screen.findByText('KTC')
    expect(screen.queryByRole('link', { name: /Open JV/ })).not.toBeInTheDocument()
  })
})

describe('the status filter chips', () => {
  it('offers three status chips between the day and the log, in reading order', async () => {
    // `failed` and `skipped` were two chips for one fact. The split behind them is whether
    // a credit was charged — the billing system's business, and nothing a reader can guess.
    // Only two of the five are about state at all: `Today` cuts across the three on time,
    // and `All` selects on nothing, which is what makes it the log.
    mount(status(), [doc()], { all: 113, today: 4, review: 3, success: 7, unposted: 103 })
    await screen.findByText('KTC')
    const labels = screen.getAllByRole('tab').map(t => t.textContent)
    expect(labels).toHaveLength(5)
    expect(labels[0]).toMatch(/Today/)
    expect(labels[4]).toMatch(/All/)
    for (const label of ['Review', 'Posted', 'Not posted']) {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('numbers only the chips whose number can go down', async () => {
    // `Review` is bounded by backpressure (50 pending, then mail is handed back) and falls
    // as it is worked; `Today` is bounded by the clock and empties itself every midnight.
    // `Posted` and `Not posted` are lifetime totals that never fall — at four figures the
    // number is furniture, and it is on screen for ever. The size of the list is in the
    // Pager once the chip is open.
    mount(status(), [doc()], { all: 113, today: 4, review: 3, success: 7, unposted: 103 })
    await screen.findByText('KTC')
    await waitFor(() => expect(screen.getByRole('tab', { name: /Review/ })).toHaveTextContent('3'))
    expect(screen.getByRole('tab', { name: /Today/ })).toHaveTextContent('4')
    for (const label of ['^Posted', 'Not posted']) {
      const chip = screen.getByRole('tab', { name: new RegExp(label) })
      expect(chip.querySelector('.rq-tab-count')).not.toBeInTheDocument()
    }
  })

  it('opens on the day when the day has something in it', async () => {
    mount(status(), [doc()], { ...ZERO, all: 113, today: 4, review: 12, unposted: 101 })
    await screen.findByText('KTC')
    expect(vi.mocked(api.listActivity).mock.calls[0][0]).toBe('today')
    expect(screen.getByRole('tab', { name: /Today/ })).toHaveAttribute('aria-selected', 'true')
    expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(1)
  })

  it('falls through a quiet day to the work owed', async () => {
    // A BU with twelve documents owed must not be shown an empty morning. The counts for
    // every chip arrive with the first response, so the fall-through knows where to go
    // rather than trying each in turn.
    mount(status(), [doc()], { ...ZERO, all: 113, today: 0, review: 12, unposted: 101 })
    await waitFor(() => expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.listActivity).mock.calls.map(c => c[0])).toEqual(['today', 'review'])
    expect(screen.getByRole('tab', { name: /Review/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows no empty table on the way through', async () => {
    // The fall-through happens behind `loading`: painting today's nothing and then the
    // work a moment later is the flash this exists to avoid.
    mount(status(), [doc()], { ...ZERO, all: 113, today: 0, review: 12 })
    expect(screen.queryByText('No activity today')).not.toBeInTheDocument()
    expect(screen.queryByText('Nothing needs review')).not.toBeInTheDocument()
    await screen.findByText('KTC')
  })

  it('never puts a dot on Today', async () => {
    // Every row under it is already counted under a chip that does light, and `unseen`
    // measures a lifetime count against a stored mark — which a number that resets at
    // midnight can never be compared against. The server sends no `today` key at all.
    mount(
      status(),
      [doc()],
      { ...ZERO, all: 60, today: 5, review: 1, unposted: 59 },
      1,
      { ...ZERO, unposted: 5 },
      { unposted: true }
    )
    await screen.findByText('KTC')
    expect(
      screen.getByRole('tab', { name: /Today/ }).querySelector('.rq-tab-dot')
    ).not.toBeInTheDocument()
  })

  it('has an All chip, last, carrying neither a count nor a dot', async () => {
    // The log. `Posted` and `Not posted` report on documents this BU paid to have read, so
    // the attachments nobody was charged for are under neither — `all` is where they are,
    // and the reason the chip came back.
    //
    // No count: a lifetime total only goes up, and the Pager prints the size once it is
    // open. No dot: every row under it is counted under a status chip too, so anything
    // wrong with one is already being pointed at there.
    mount(
      status(),
      [doc()],
      { all: 113, today: 5, review: 3, success: 7, unposted: 5 },
      1,
      { ...ZERO, unposted: 5 },
      { unposted: true }
    )
    const all = await screen.findByRole('tab', { name: /^All/ })
    expect(all).not.toHaveTextContent('113')
    expect(all.querySelector('.rq-tab-dot')).not.toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs[tabs.length - 1]).toBe(all)
  })

  it('asks the server for the whole log when All is clicked', async () => {
    mount(status(), [doc()], { all: 113, today: 5, review: 3, success: 7, unposted: 5 })
    await screen.findByText('KTC')
    fireEvent.click(screen.getByRole('tab', { name: /^All/ }))
    await waitFor(() => expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.listActivity).mock.calls[1][0]).toBe('all')
  })

  it('shows a zero on the work chip rather than dropping the number', async () => {
    // A count that disappears when it empties makes the strip reflow as documents are
    // approved, and "0" is itself the answer to "is anything waiting?".
    mount(status(), [], ZERO)
    const chip = await screen.findByRole('tab', { name: /Review/ })
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
    // `today` non-zero so the page lands there and the fall-through never runs — this is
    // about what a chip click costs, not about where the page opens.
    mount(status(), [doc()], { ...ZERO, all: 5, today: 5, review: 1, success: 4 })
    await screen.findByRole('tab', { name: /Posted/ })
    expect(vi.mocked(api.getReviewStatus)).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: /Posted/ }))
    await waitFor(() => expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.getReviewStatus)).toHaveBeenCalledTimes(1)
  })

  it('hides the chips from a BU with no documents at all', async () => {
    // Three zeroes above an explanation of what the feature is would be scaffolding,
    // not navigation.
    mount(status({ enabled: false, blockers: ['disabled'] }), [], ZERO)
    await screen.findByText('Let statements post themselves')
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('never puts a tick on an empty Not posted chip', async () => {
    // An empty pile of failures is not an achievement; celebrating a non-event is how a
    // success screen stops meaning anything. It still gets a real card — the bare grey
    // paragraph it used to get was the one thing on this page that looked unfinished.
    mount(status(), [], { ...ZERO, all: 2, success: 2 })
    fireEvent.click(await screen.findByRole('tab', { name: /Not posted/ }))
    const card = (await screen.findByText('No failed documents')).closest('.rq-empty')
    expect(card?.querySelector('.rq-empty-icon--calm')).toBeInTheDocument()
    expect(card?.querySelector('.rq-empty-icon--ok')).not.toBeInTheDocument()
  })

  it('offers the log as the way out of a chip that has nothing', async () => {
    // Since `all` became a chip, a BU whose whole history is rows nobody was charged for
    // is told "nothing here" while holding a hundred it cannot reach from this screen.
    mount(status(), [], { ...ZERO, all: 101 })
    fireEvent.click(await screen.findByRole('button', { name: 'View all activity' }))
    await waitFor(() => expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.listActivity).mock.calls[1][0]).toBe('all')
  })

  it('does not offer the log when there is no history to see', async () => {
    // A link to an empty list is worse than no link.
    mount(status(), [], ZERO)
    await screen.findByText('No activity today')
    expect(screen.queryByRole('button', { name: 'View all activity' })).not.toBeInTheDocument()
  })

  it('falls through an empty Review to Posted', async () => {
    // What the old `auto_post ? success : review` rule was for: with review switched off
    // that chip is empty for ever, and landing there would hide the only thing the page has
    // to show such a BU — the work the robot is doing for it. Falling through an empty chip
    // covers that without asking, and covers a BU that has merely caught up as well.
    mount(status({ auto_post: true }), [], { ...ZERO, all: 40, success: 40 })
    await waitFor(() => expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.listActivity).mock.calls.map(c => c[0])).toEqual(['today', 'success'])
    expect(screen.getByRole('tab', { name: /^Posted/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('stays on the day when every chip is empty', async () => {
    // Nowhere better to be, and the tick is the honest answer: the fall-through only
    // reaches this state when Review and Posted are empty too.
    mount(status(), [], ZERO)
    expect(await screen.findByText('No activity today')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Today/ })).toHaveAttribute('aria-selected', 'true')
    expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(1)
  })

  it('does not re-land after a refresh', async () => {
    // A reader who walked to Not posted must stay there when the list reloads, and a chip
    // worked down to zero must not throw them somewhere else mid-task.
    mount(status(), [doc()], { ...ZERO, all: 5, today: 5, review: 5 })
    await screen.findByText('KTC')
    fireEvent.click(screen.getByRole('tab', { name: /Not posted/ }))
    await waitFor(() => expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.listActivity).mock.calls[1][0]).toBe('unposted')
    expect(screen.getByRole('tab', { name: /Not posted/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('marks a chip that is hiding an anomaly, whoever can fix it', async () => {
    // The dot means "something is off", not "you can fix it" — a failure nobody in the BU
    // can clear is still a failure, and every customer-clearable cause now shares one chip
    // with the rest. Without the marker the 2026-08-28 incident has its conditions back.
    mount(
      status(),
      [doc()],
      { ...ZERO, all: 60, review: 1, unposted: 59 },
      1,
      { ...ZERO, all: 5, unposted: 5 },
      { unposted: true }
    )
    await screen.findByText('KTC')
    const unposted = screen.getByRole('tab', { name: /Not posted/ })
    expect(unposted).toHaveTextContent('5 need attention')
    expect(unposted.querySelector('.rq-tab-dot')).toBeInTheDocument()
    // And stays quiet on a chip with nothing wrong under it.
    const posted = screen.getByRole('tab', { name: /Posted/ })
    expect(posted.querySelector('.rq-tab-dot')).not.toBeInTheDocument()
  })

  it('marks a JV that posted without its input-tax record', async () => {
    // The quietest outcome in the system: the row wears the Success pill and nothing else
    // in the app says the VAT record never happened.
    //
    // `today` non-zero so the page stays there. A dot is a signal about a chip you are NOT
    // on — landing on Posted would mark it seen and put the dot out, which is the feature
    // working rather than this test's subject.
    mount(
      status(),
      [doc()],
      { ...ZERO, all: 20, today: 3, success: 20 },
      1,
      { ...ZERO, all: 2, success: 2 },
      { success: true }
    )
    // The strip renders as soon as status lands, a beat before the counts do — wait for a
    // row, or this asserts against the empty first paint.
    await screen.findByText('KTC')
    expect(
      screen.getByRole('tab', { name: /^Posted/ }).querySelector('.rq-tab-dot')
    ).toBeInTheDocument()
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
    // The repair is the cell's own link again. §16 put it behind a Details dialog to pair
    // it with a dismiss; the dismiss belongs to the cause now, so the dialog held nothing
    // the row was not already printing.
    mount(status(), [doc({ status: 'failed', reason_code: 'mapping_incomplete', total: 0 })])
    expect(await screen.findByRole('link', { name: 'Fix mapping' })).toHaveAttribute(
      'href',
      '#/CreditCardOCR/mapping'
    )
  })

  // The regression that matters: the ledger's skipped/failed split is about whether a
  // credit was charged, NOT about whether anyone can act. Keying the action off `status`
  // hides every one of these behind the chip the design doc calls "mostly noise" — which
  // is how eight sender_not_allowed rows cost a day of diagnosis on 2026-08-28.
  it.each(['no_rule_match', 'sender_not_allowed', 'wrong_pdf_password', 'ingest_paused'])(
    'offers settings on a *skipped* %s row',
    async reason_code => {
      mount(status(), [doc({ status: 'skipped', reason_code, total: 0 })])
      expect(await screen.findByRole('link', { name: 'Open settings' })).toHaveAttribute(
        'href',
        '#/email-settings'
      )
    }
  )

  it('gives a dead Carmen credential its own word, not a generic settings link', async () => {
    // One expired token fails EVERY document of the BU until someone re-pastes it, so it
    // is not "a setting is off" — it is "the pipeline is down".
    mount(status(), [doc({ status: 'failed', reason_code: 'carmen_unauthorized', total: 0 })])
    expect(
      await screen.findByText(/Carmen posting credential is no longer accepted/)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reconnect' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open settings' })).not.toBeInTheDocument()
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

  // The Detail column used to print a three-word phrase and hide everything that told two
  // rows apart on the cell's hover title: eight identical "Carmen refused it" rows, and a
  // rejection that read "rejected by somchai - rejected" because {reason} was fed the
  // reason-code phrase rather than the words the reviewer typed. The detail now replaces
  // the phrase rather than joining it — one sentence per row, said once.
  it('prints what Carmen actually said, not just that it said something', async () => {
    mount(status(), [
      doc({
        status: 'failed',
        reason_code: 'carmen_rejected',
        error_message: 'Carmen: Period 2026-08 is closed',
        total: 0,
      }),
    ])
    expect(await screen.findByText('Carmen: Period 2026-08 is closed')).toBeInTheDocument()
    expect(screen.queryByText(/Carmen refused it/)).toBeNull()
  })

  it('tells the two kinds of duplicate apart', async () => {
    mount(status(), [
      doc({
        status: 'failed',
        reason_code: 'duplicate_document',
        error_message: 'a copy is already waiting for review',
        total: 0,
      }),
    ])
    expect(await screen.findByText('a copy is already waiting for review')).toBeInTheDocument()
    expect(screen.queryByText(/already handled/)).toBeNull()
  })

  it("prints the reviewer's own words when they left any, and never the word twice", async () => {
    mount(status(), [
      doc({
        status: 'rejected',
        reason_code: 'rejected_by_reviewer',
        error_message: 'wrong company',
        reviewed_by_name: 'somchai',
        total: 0,
      }),
    ])
    expect(
      await screen.findByText('Reviewed and rejected by somchai: wrong company')
    ).toBeInTheDocument()
  })

  // Both are under Not posted and neither became a JV, but one means something broke and
  // the other means a colleague read it and said no. One pill for both had a BU counting
  // somchai's judgement calls among its problems.
  it('does not dress a deliberate rejection as a failure', async () => {
    mount(status(), [
      doc({
        status: 'rejected',
        reason_code: 'rejected_by_reviewer',
        reviewed_by_name: 'somchai',
        total: 0,
      }),
    ])
    expect(await screen.findByText('Rejected')).toBeInTheDocument()
    expect(screen.queryByText('Failed')).toBeNull()
  })

  it('says only who rejected it when no reason was typed', async () => {
    mount(status(), [
      doc({
        status: 'rejected',
        reason_code: 'rejected_by_reviewer',
        error_message: null,
        reviewed_by_name: 'somchai',
        total: 0,
      }),
    ])
    expect(await screen.findByText('Reviewed and rejected by somchai')).toBeInTheDocument()
  })

  // The two codes whose detail is a raw `str(exc)` from the PDF reader stay on the title.
  it('keeps a raw exception out of the cell', async () => {
    mount(status(), [
      doc({
        status: 'failed',
        reason_code: 'unreadable_document',
        error_message: 'PdfReadError: EOF marker not found',
        total: 0,
      }),
    ])
    expect(await screen.findByText('Could not read the document')).toBeInTheDocument()
    expect(screen.queryByText(/PdfReadError/)).toBeNull()
  })

  it('does not dress a document we never finished as one we deliberately skipped', async () => {
    // `received` is the state every row is CLAIMED into — the backlog cap writes no row at
    // all — so one still sitting there means the pipeline picked the message up and
    // stopped. It used to wear the same calm grey "Skipped · no reason recorded" as a
    // filename rule doing its job.
    mount(status(), [doc({ status: 'received', reason_code: null, total: 0 })])
    expect(await screen.findByText('Unfinished')).toBeInTheDocument()
    expect(screen.getByText('We started reading this and stopped')).toBeInTheDocument()
    expect(screen.queryByText('No reason recorded')).not.toBeInTheDocument()
  })

  it('falls back to the raw reason code rather than showing nothing', async () => {
    // An unfamiliar code is still a lead; a blank is not.
    mount(status(), [doc({ status: 'failed', reason_code: 'something_new', total: 0 })])
    expect(await screen.findByText('something_new')).toBeInTheDocument()
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
    // The switch renders from the fetched status, so the page has to ask again rather
    // than keeping a second copy of the answer.
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

describe('the dot the whole business unit shares', () => {
  it('puts it out for everyone once somebody opens the chip', async () => {
    // Nothing retries a failure, so the count behind the dot never falls on its own. What
    // ends it is a person looking — and because the mark lives on the server, it ends for
    // the colleague on the next desk too.
    mount(
      status(),
      [doc()],
      { ...ZERO, all: 60, review: 1, unposted: 59 },
      1,
      { ...ZERO, all: 5, unposted: 5 },
      { unposted: true }
    )
    await screen.findByText('KTC')
    expect(
      screen.getByRole('tab', { name: /Not posted/ }).querySelector('.rq-tab-dot')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Not posted/ }))
    await waitFor(() => expect(api.markChipSeen).toHaveBeenCalledWith('unposted'))
    // Cleared locally rather than by refetching: the POST changes what the next GET would
    // say, and asking it costs a round trip to be told what we already know.
    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: /Not posted/ }).querySelector('.rq-tab-dot')
      ).not.toBeInTheDocument()
    )
  })

  it('marks nothing when there is nothing wrong under the open chip', async () => {
    // The guard against a write on every page load. The gate is the same value the write
    // clears, which is also what stops it looping.
    mount(status(), [doc()], { ...ZERO, all: 60, today: 1, review: 1, unposted: 59 }, 1, ZERO, {})
    await screen.findByText('KTC')
    fireEvent.click(screen.getByRole('tab', { name: /Not posted/ }))
    await waitFor(() => expect(vi.mocked(api.listActivity)).toHaveBeenCalledTimes(2))
    expect(api.markChipSeen).not.toHaveBeenCalled()
  })

  it('survives a mark that never reaches the server', async () => {
    // A dot that stays on until next time is not worth an error message, and must never
    // be mistaken for the list itself having failed.
    vi.mocked(api.markChipSeen).mockRejectedValue(new Error('offline'))
    mount(
      status(),
      [doc()],
      { ...ZERO, all: 60, review: 1, unposted: 59 },
      1,
      { ...ZERO, all: 5, unposted: 5 },
      { unposted: true }
    )
    await screen.findByText('KTC')
    fireEvent.click(screen.getByRole('tab', { name: /Not posted/ }))
    await waitFor(() => expect(api.markChipSeen).toHaveBeenCalled())
    expect(screen.queryByText('Could not load the queue')).not.toBeInTheDocument()
    expect(await screen.findByText('KTC')).toBeInTheDocument()
  })
})
