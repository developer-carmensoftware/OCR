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
      en: {
        title: 'Newer',
        features: ['a1'],
        fixes: [{ text: 'a2', before: 'a2-before' }],
        qol: ['a3'],
      },
      th: {
        title: 'ใหม่กว่า',
        features: ['ก1'],
        fixes: [{ text: 'ก2', before: 'ก2-เดิม' }],
        qol: ['ก3'],
      },
    },
    {
      date: '2026-07-10',
      version: '1.0.0',
      // Only one category — the other two sections must not render at all.
      en: { title: 'Older', fixes: [{ text: 'b1', before: 'b1-before' }] },
      th: { title: 'เก่ากว่า', fixes: [{ text: 'ข1', before: 'ข1-เดิม' }] },
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

  it('groups bullets under their category', () => {
    render(<WhatsNew />)
    const labels = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    // Newer has all three, in a fixed order; Older only has fixes.
    expect(labels).toEqual(['New features', 'Fixed', 'Improved', 'Fixed'])
  })

  it('shows what a fix was like before, for every fix', () => {
    render(<WhatsNew />)
    expect(screen.getByText('a2-before')).toBeInTheDocument()
    expect(screen.getByText('b1-before')).toBeInTheDocument()
    // Twice: once per entry that has a fix.
    expect(screen.getAllByText('Before')).toHaveLength(2)
  })

  it('omits categories an entry has nothing in', () => {
    render(<WhatsNew />)
    // Only the newer entry has features/qol, so each label appears exactly once.
    expect(screen.getAllByText('New features')).toHaveLength(1)
    expect(screen.getAllByText('Improved')).toHaveLength(1)
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
