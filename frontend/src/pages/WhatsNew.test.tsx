import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'

// Fixed content: the real file changes with every user-visible release, and this
// is about the page behaviour, not about what shipped on a given day.
vi.mock('../content/releaseNotes', () => ({
  RELEASE_NOTES: [
    {
      date: '2026-07-20',
      version: '1.1.0',
      en: { title: 'Newer', items: ['a1'] },
      th: { title: 'ใหม่กว่า', items: ['ก1'] },
    },
    {
      date: '2026-07-10',
      version: '1.0.0',
      en: { title: 'Older', items: ['b1'] },
      th: { title: 'เก่ากว่า', items: ['ข1'] },
    },
  ],
  LATEST_RELEASE: '2026-07-20',
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))

const { default: WhatsNew } = await import('./WhatsNew')
const { readReleaseSeen } = await import('../lib/releaseNotesSeen')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.location.hash = ''
})

describe('WhatsNew', () => {
  it('lists every release, newest first, with its bullets', () => {
    render(<WhatsNew />)
    const titles = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(titles).toEqual(['Newer', 'Older'])
    expect(screen.getByText('a1')).toBeInTheDocument()
    expect(screen.getByText('b1')).toBeInTheDocument()
    expect(screen.getByText('v1.1.0')).toBeInTheDocument()
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
  })

  it('clears the seen mark on mount — arriving here is reading them', () => {
    expect(readReleaseSeen()).toBe('')
    render(<WhatsNew />)
    expect(readReleaseSeen()).toBe('2026-07-20')
  })

  it('still tags unread entries on the visit that clears them', () => {
    localStorage.setItem('releaseNotesSeen', '2026-07-10')
    render(<WhatsNew />)
    // Only the newer entry is tagged: the mark is captured before it advances.
    expect(screen.getAllByText('New')).toHaveLength(1)
  })

  it('tags nothing once everything has been seen', () => {
    localStorage.setItem('releaseNotesSeen', '2026-07-20')
    render(<WhatsNew />)
    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('goes back where the bell was clicked from', () => {
    sessionStorage.setItem('whatsnew:returnTo', '#/apinvoice')
    render(<WhatsNew />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(window.location.hash).toBe('#/apinvoice')
  })

  it('falls back to home when opened directly', () => {
    render(<WhatsNew />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(window.location.hash).toBe('#/')
  })

  it('renders Thai copy for the same entries', () => {
    localStorage.setItem('lang', 'th')
    render(
      <LanguageProvider>
        <WhatsNew />
      </LanguageProvider>
    )
    expect(screen.getByText('ใหม่กว่า')).toBeInTheDocument()
    expect(screen.getByText('ก1')).toBeInTheDocument()
    expect(screen.queryByText('Newer')).not.toBeInTheDocument()
  })
})
