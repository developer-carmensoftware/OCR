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
