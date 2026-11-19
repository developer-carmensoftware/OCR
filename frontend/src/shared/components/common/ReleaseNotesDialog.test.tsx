import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'

// Fixed content: the real file changes with every release, and this is about the
// dialog's behaviour, not about what shipped in a given month.
vi.mock('@/shared/content/releaseNotes', () => ({
  RELEASE_NOTES: [
    {
      date: '2026-07-20',
      version: '1.1.0',
      en: { features: ['Feature A (AI JV Automation): a1'], enhancements: ['Fix A (AP): a2'] },
      th: { features: ['ฟีเจอร์ ก (AI JV Automation): ก1'], enhancements: ['แก้ ก (AP): ก2'] },
    },
    {
      date: '2026-06-10',
      version: '1.0.0',
      // A baseline entry: Key Features, no New Features — that section must not render.
      en: { keyFeatures: ['Core B (AP): k1'], enhancements: ['Fix B (AP): b1'] },
      th: { keyFeatures: ['หลัก ข (AP): ข0'], enhancements: ['แก้ ข (AP): ข1'] },
    },
  ],
  LATEST_RELEASE: '2026-07-20',
}))

const { default: ReleaseNotesDialog } = await import('./ReleaseNotesDialog')
const { readReleaseSeen } = await import('@/shared/lib/releaseNotesSeen')

const onClose = vi.fn()

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ReleaseNotesDialog', () => {
  it('is the Changelog dialog, listing every release newest first', () => {
    render(<ReleaseNotesDialog onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Changelog' })
    const entries = within(dialog)
      .getAllByRole('listitem')
      .filter(li => li.matches('.relnotes-entry'))
    expect(entries.map(e => e.querySelector('.relnotes-version')?.textContent)).toEqual([
      '1.1.0',
      '1.0.0',
    ])
    expect(screen.getByText('Feature A (AI JV Automation): a1')).toBeInTheDocument()
    expect(screen.getByText('Fix B (AP): b1')).toBeInTheDocument()
  })

  it('shows the release date once, as DD/MM/YYYY', () => {
    render(<ReleaseNotesDialog onClose={onClose} />)
    expect(screen.getByText('Release date 20/07/2026')).toBeInTheDocument()
    expect(screen.getByText('Release date 10/06/2026')).toBeInTheDocument()
  })

  it('groups bullets by section, Key Features first, omitting empty ones', () => {
    render(<ReleaseNotesDialog onClose={onClose} />)
    const labels = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(labels).toEqual(['New Features', 'Enhancements', 'Key Features', 'Enhancements'])
    expect(screen.getByText('Core B (AP): k1')).toBeInTheDocument()
  })

  it('clears the seen mark on mount — opening it is reading them', () => {
    expect(readReleaseSeen()).toBe('')
    render(<ReleaseNotesDialog onClose={onClose} />)
    expect(readReleaseSeen()).toBe('2026-07-20')
  })

  it('still tags unread entries on the visit that clears them', () => {
    localStorage.setItem('releaseNotesSeen', '2026-06-10')
    render(<ReleaseNotesDialog onClose={onClose} />)
    // Only the newer entry is tagged: the mark is captured before it advances.
    expect(screen.getAllByText('New')).toHaveLength(1)
  })

  it('tags nothing once everything has been seen', () => {
    localStorage.setItem('releaseNotesSeen', '2026-07-20')
    render(<ReleaseNotesDialog onClose={onClose} />)
    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('closes from the X and from Escape', () => {
    render(<ReleaseNotesDialog onClose={onClose} />)
    // Inside the box: the backdrop button outside it carries the same label.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders Thai copy and labels for the same entries', () => {
    localStorage.setItem('lang', 'th')
    render(
      <LanguageProvider>
        <ReleaseNotesDialog onClose={onClose} />
      </LanguageProvider>
    )
    expect(screen.getByRole('dialog', { name: 'บันทึกการอัปเดต' })).toBeInTheDocument()
    expect(screen.getByText('ฟีเจอร์ ก (AI JV Automation): ก1')).toBeInTheDocument()
    expect(screen.getByText('วันที่เผยแพร่ 20/07/2026')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ฟีเจอร์หลัก' })).toBeInTheDocument()
    expect(screen.queryByText('Feature A (AI JV Automation): a1')).not.toBeInTheDocument()
  })
})
