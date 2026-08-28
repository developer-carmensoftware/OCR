import type React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import ReviewQueue from './ReviewQueue'
import type { ReviewDocument, ReviewStatus } from '../lib/api/emailReview'

vi.mock('../lib/api/emailReview', () => ({
  listPending: vi.fn(),
  getReviewStatus: vi.fn(),
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
    doc_date: '15/01/2026',
    total: 48200,
    line_count: 14,
    flags: [],
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
    pending: 0,
    ...over,
  }
}

function mount(s: ReviewStatus, rows: ReviewDocument[], total = rows.length) {
  vi.mocked(api.getReviewStatus).mockResolvedValue(s)
  vi.mocked(api.listPending).mockResolvedValue({ total, limit: 25, offset: 0, data: rows })
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
    vi.mocked(api.listPending).mockRejectedValue(new Error('offline'))
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
