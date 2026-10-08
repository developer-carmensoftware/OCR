import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FixedLanguage, LanguageProvider, useT } from './LanguageContext'

function Probe({ id }: { id: string }) {
  const { lang, t } = useT()
  return <span data-testid={id}>{`${lang}:${t('common.copy')}`}</span>
}

afterEach(() => localStorage.removeItem('lang'))

describe('FixedLanguage', () => {
  it('pins its subtree to one language while the rest follows the toggle', () => {
    localStorage.setItem('lang', 'th')
    render(
      <LanguageProvider>
        <Probe id="app" />
        <FixedLanguage lang="en">
          <Probe id="pinned" />
        </FixedLanguage>
      </LanguageProvider>
    )
    expect(screen.getByTestId('app')).toHaveTextContent('th:คัดลอก')
    expect(screen.getByTestId('pinned')).toHaveTextContent('en:Copy')
  })
})
