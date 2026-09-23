import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import type { BellItem } from '../../lib/api/notifications'

// This component mounts in AppHeader on every user-facing page, so a crash here
// takes the whole surface down. These cover the render + navigation path; the
// merge/seen logic lives in hooks/notifications/useNotifications.test.ts.

const markRead = vi.fn()
let items: BellItem[] = []
let unreadCount = 0

vi.mock('../../hooks/notifications', () => ({
  useNotifications: () => ({ items, unreadCount, markRead, refresh: vi.fn() }),
}))

const { default: NotificationBell } = await import('./NotificationBell')

const releaseRow: BellItem = {
  id: 'release:2026-07-20',
  order_id: null,
  type: 'release_note',
  payload: {
    en: { title: 'Maintenance notices', items: ['Updates appear here.'] },
    th: { title: 'แจ้งเตือนการปิดปรับปรุง', items: ['การอัปเดตจะแสดงที่นี่'] },
  },
  read_at: null,
  created_at: '2026-07-20T00:00:00+07:00',
}

const orderRow: BellItem = {
  id: 'uuid-1',
  order_id: 'order-1',
  type: 'approved',
  payload: { credits: 100 },
  read_at: null,
  created_at: new Date().toISOString(),
}

const failedRow: BellItem = {
  id: 'uuid-2',
  order_id: null,
  type: 'document_failed',
  payload: {
    document_id: 'doc-1',
    attachment: 'ktc-fee-2026-08.pdf',
    bank_code: 'KTC',
    doc_no: 'INV-001',
    reason_code: 'carmen_rejected',
    message: 'Code 1: Insufficient balance',
  },
  read_at: null,
  created_at: new Date().toISOString(),
}

const postedRow: BellItem = {
  id: 'uuid-3',
  order_id: null,
  type: 'document_posted',
  payload: {
    document_id: 'doc-2',
    attachment: 'bay-2026-08.pdf',
    bank_code: 'BAY',
    doc_no: '265-0850661',
    jv_no: '982',
  },
  read_at: null,
  created_at: new Date().toISOString(),
}

function openPanel() {
  render(<NotificationBell />)
  fireEvent.click(screen.getByRole('button', { name: /notification/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  items = [releaseRow, orderRow]
  unreadCount = 2
  window.location.hash = '#/apinvoice'
})

describe('NotificationBell — release notes', () => {
  it('shows the release title as a row', () => {
    openPanel()
    expect(screen.getByText('Maintenance notices')).toBeInTheDocument()
  })

  it('opens the What’s New page and closes the panel', () => {
    openPanel()
    fireEvent.click(screen.getByText('Maintenance notices'))
    expect(window.location.hash).toBe('#/whats-new')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stashes where it came from for the page back button', () => {
    openPanel()
    fireEvent.click(screen.getByText('Maintenance notices'))
    expect(sessionStorage.getItem('whatsnew:returnTo')).toBe('#/apinvoice')
  })

  it('does not mark read on click — the page clears the mark on mount', () => {
    openPanel()
    fireEvent.click(screen.getByText('Maintenance notices'))
    expect(markRead).not.toHaveBeenCalled()
  })

  it('renders the row title in Thai when the language is th', () => {
    localStorage.setItem('lang', 'th')
    render(
      <LanguageProvider>
        <NotificationBell />
      </LanguageProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: /การแจ้งเตือน/ }))
    expect(screen.getByText('แจ้งเตือนการปิดปรับปรุง')).toBeInTheDocument()
    expect(screen.queryByText('Maintenance notices')).not.toBeInTheDocument()
  })

  it('leaves order notifications navigating to their order', () => {
    openPanel()
    fireEvent.click(screen.getByText(/Order approved/i))
    expect(window.location.hash).toBe('#/pricing/orders?id=order-1')
    expect(markRead).toHaveBeenCalledWith(['uuid-1'])
  })
})

// These carry no order_id, so before the detail dialog existed they dumped the
// user on the credit-order history page — an unrelated surface.
describe('NotificationBell — email automation rows', () => {
  beforeEach(() => {
    items = [failedRow]
    unreadCount = 1
  })

  it('names the document instead of rendering the raw type', () => {
    openPanel()
    expect(screen.getByText(/ktc-fee-2026-08\.pdf/)).toBeInTheDocument()
    expect(screen.queryByText('document_failed')).not.toBeInTheDocument()
  })

  it('opens the detail dialog in place rather than navigating', () => {
    openPanel()
    fireEvent.click(screen.getByText(/ktc-fee-2026-08\.pdf/))
    expect(window.location.hash).toBe('#/apinvoice')
    expect(markRead).toHaveBeenCalledWith(['uuid-2'])
    expect(screen.getByText('Could not post')).toBeInTheDocument()
  })

  it('shows the document, bank and reason, and keeps the raw error', () => {
    openPanel()
    fireEvent.click(screen.getByText(/ktc-fee-2026-08\.pdf/))
    expect(screen.getByText('Krungthai Card (KTC)')).toBeInTheDocument()
    expect(screen.getByText('INV-001')).toBeInTheDocument()
    expect(screen.getByText('Carmen refused the journal voucher.')).toBeInTheDocument()
    expect(screen.getByText('Code 1: Insufficient balance')).toBeInTheDocument()
  })

  it('offers the JV in Carmen once a document posted', () => {
    items = [postedRow]
    openPanel()
    fireEvent.click(screen.getByText(/bay-2026-08\.pdf/))
    const jv = screen.getByRole('link', { name: /Open JV in Carmen/i })
    expect(jv).toHaveAttribute('href', expect.stringContaining('/glJv/982/show'))
    expect(jv).toHaveAttribute('target', '_blank')
  })

  it('has no JV link on a failure', () => {
    openPanel()
    fireEvent.click(screen.getByText(/ktc-fee-2026-08\.pdf/))
    expect(screen.queryByRole('link', { name: /Open JV/i })).not.toBeInTheDocument()
  })
})

// Blocked/failed rows collapse per reason since 2026-09-23 (notify_collapsed in
// email_ingest_service.py): a `count` and no `document_id`, so there is no single
// document left to open a dialog for.
describe('NotificationBell — collapsed blocked/failed rows', () => {
  const blockedRow: BellItem = {
    id: 'uuid-4',
    order_id: null,
    type: 'document_blocked',
    payload: { reason_code: 'wrong_pdf_password', count: 3, key: 'wrong_pdf_password' },
    read_at: null,
    created_at: new Date().toISOString(),
  }

  beforeEach(() => {
    items = [blockedRow]
    unreadCount = 1
  })

  it('shows a count and the reason instead of one filename', () => {
    openPanel()
    expect(screen.getByText('3 files: wrong PDF password')).toBeInTheDocument()
  })

  it('opens the queue on the unposted chip instead of a detail dialog', () => {
    openPanel()
    fireEvent.click(screen.getByText('3 files: wrong PDF password'))
    expect(window.location.hash).toBe('#/CreditCardOCR?filter=unposted')
    expect(markRead).toHaveBeenCalledWith(['uuid-4'])
    expect(screen.queryByRole('dialog', { name: /Could not/i })).not.toBeInTheDocument()
  })
})

// The other shape `document_blocked` carries in existing data: a bare `{blocked: N}`
// queue-level count from before 2026-09-23, written by the `_notify_pending` this session
// deleted. No document_id, so — unlike the collapsed-per-reason shape above — there was
// never a document to show, and the old code opened an empty detail dialog for it (found
// via Playwright MCP against real dev data: Document —, Bank —, Doc no. —, "The document
// could not be processed.").
describe('NotificationBell — orphaned {blocked: N} rows (pre-2026-09-23 shape)', () => {
  const orphanRow: BellItem = {
    id: 'uuid-6',
    order_id: null,
    type: 'document_blocked',
    payload: { blocked: 7 },
    read_at: null,
    created_at: new Date().toISOString(),
  }

  beforeEach(() => {
    items = [orphanRow]
    unreadCount = 1
  })

  it('shows a count instead of an empty document label', () => {
    openPanel()
    expect(screen.getByText('7 documents need attention')).toBeInTheDocument()
  })

  it('opens the queue on the unposted chip instead of the empty detail dialog', () => {
    openPanel()
    fireEvent.click(screen.getByText('7 documents need attention'))
    expect(window.location.hash).toBe('#/CreditCardOCR?filter=unposted')
    expect(markRead).toHaveBeenCalledWith(['uuid-6'])
    expect(screen.queryByText('Could not read this document')).not.toBeInTheDocument()
  })
})

describe('NotificationBell — pending review carrying a blocked count', () => {
  it('folds the blocked count into the same row', () => {
    items = [
      {
        id: 'uuid-5',
        order_id: null,
        type: 'document_pending_review',
        payload: { pending: 12, blocked: 4 },
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ]
    unreadCount = 1
    openPanel()
    expect(screen.getByText('12 waiting for your review — 4 blocked')).toBeInTheDocument()
  })
})

// Inline styles beat media queries, so the phone layout in notification-bell.css
// only works if the component stops setting `right` below 480px.
describe('NotificationBell — panel anchoring', () => {
  const setWidth = (w: number) => {
    Object.defineProperty(window, 'innerWidth', { value: w, configurable: true })
  }

  it('anchors to the bell on desktop', () => {
    setWidth(1280)
    openPanel()
    expect(screen.getByRole('dialog').style.right).not.toBe('')
  })

  it('leaves `right` to CSS on phones so the panel can be a full-width sheet', () => {
    setWidth(390)
    openPanel()
    expect(screen.getByRole('dialog').style.right).toBe('')
    expect(screen.getByRole('dialog').style.top).not.toBe('')
  })
})
