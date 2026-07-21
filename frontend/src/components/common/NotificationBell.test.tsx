import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import type { BellItem } from '../../lib/api/notifications'

// This component mounts in AppHeader on every user-facing page, so a crash here
// takes the whole surface down. These cover the render + expand path; the
// merge/seen logic is covered in hooks/notifications/useNotifications.test.ts.

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
    en: { title: 'Maintenance notices', items: ['Updates appear here.', 'Bar shows a countdown.'] },
    th: { title: 'แจ้งเตือนการปิดปรับปรุง', items: ['การอัปเดตจะแสดงที่นี่', 'แถบแสดงนับถอยหลัง'] },
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
  items = [releaseRow, orderRow]
  unreadCount = 2
  window.location.hash = ''
})

describe('NotificationBell — release notes', () => {
  it('renders the release title collapsed, without its bullets', () => {
    openPanel()
    expect(screen.getByText('Maintenance notices')).toBeInTheDocument()
    expect(screen.queryByText('Updates appear here.')).not.toBeInTheDocument()
  })

  it('expands bullets on click and marks the note read', () => {
    openPanel()
    fireEvent.click(screen.getByText('Maintenance notices'))
    expect(screen.getByText('Updates appear here.')).toBeInTheDocument()
    expect(screen.getByText('Bar shows a countdown.')).toBeInTheDocument()
    expect(markRead).toHaveBeenCalledWith(['release:2026-07-20'])
  })

  it('keeps the panel open and does not navigate', () => {
    openPanel()
    fireEvent.click(screen.getByText('Maintenance notices'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('collapses on a second click', () => {
    openPanel()
    const row = screen.getByText('Maintenance notices')
    fireEvent.click(row)
    fireEvent.click(row)
    expect(screen.queryByText('Updates appear here.')).not.toBeInTheDocument()
  })

  it('exposes expanded state to assistive tech', () => {
    openPanel()
    const row = screen.getByText('Maintenance notices').closest('button')!
    expect(row).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
  })

  it('leaves order notifications navigating to their order', () => {
    openPanel()
    fireEvent.click(screen.getByText(/Order approved/i))
    expect(window.location.hash).toBe('#/pricing/orders?id=order-1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders Thai copy from the same row when the language is th', () => {
    localStorage.setItem('lang', 'th')
    render(
      <LanguageProvider>
        <NotificationBell />
      </LanguageProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: /การแจ้งเตือน/ }))
    fireEvent.click(screen.getByText('แจ้งเตือนการปิดปรับปรุง'))
    expect(screen.getByText('การอัปเดตจะแสดงที่นี่')).toBeInTheDocument()
    expect(screen.queryByText('Maintenance notices')).not.toBeInTheDocument()
  })

  it('nests bullets outside the row button (a list inside a button is invalid)', () => {
    openPanel()
    fireEvent.click(screen.getByText('Maintenance notices'))
    const row = screen.getByText('Maintenance notices').closest('button')!
    expect(within(row).queryByRole('list')).toBeNull()
  })
})
