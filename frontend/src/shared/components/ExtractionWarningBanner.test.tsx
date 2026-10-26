// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'
import ExtractionWarningBanner from './ExtractionWarningBanner'

function show(lang: 'en' | 'th', code: string, params?: Record<string, string>) {
  localStorage.setItem('lang', lang)
  render(
    <LanguageProvider>
      <ExtractionWarningBanner warnings={[{ code, params }]} />
    </LanguageProvider>
  )
}

afterEach(() => localStorage.clear())

// CA-123: the backend names the finding (`apQtyPriceMismatch` + the lines), the banner
// writes the sentence in the reader's language.
describe('ExtractionWarningBanner — apQtyPriceMismatch', () => {
  it('names the lines in English', () => {
    show('en', 'apQtyPriceMismatch', { lines: '2, 3' })
    expect(
      screen.getByText(
        'Qty × unit price does not equal the amount on line 2, 3 — check the quantities.'
      )
    ).toBeInTheDocument()
  })

  it('names the lines in Thai', () => {
    show('th', 'apQtyPriceMismatch', { lines: '2, 3' })
    expect(screen.getByText(/บรรทัดที่ 2, 3/)).toBeInTheDocument()
  })

  it('prints an unknown code rather than nothing', () => {
    show('en', 'notAWarningYet')
    expect(screen.getByText('notAWarningYet')).toBeInTheDocument()
  })
})
