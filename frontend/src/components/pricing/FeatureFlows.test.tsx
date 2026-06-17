// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import FeatureFlows from './FeatureFlows'

describe('FeatureFlows accordion', () => {
  it('toggles a tab open and closed on click', () => {
    render(
      <LanguageProvider>
        <FeatureFlows />
      </LanguageProvider>
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')

    fireEvent.click(tabs[0])
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')

    fireEvent.click(tabs[0])
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')
  })
})
