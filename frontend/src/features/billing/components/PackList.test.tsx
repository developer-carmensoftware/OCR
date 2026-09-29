// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'
import PackList from './PackList'
import { DEMO_PACKS } from './tutorial/fixtures'

/**
 * The save chip is derived from the catalog (each pack's per-doc rate against the
 * dearest one), so a reprice moves it without a frontend edit. Numbers only, so the
 * assertion holds in either language.
 */
describe('PackList save chip', () => {
  it('shows each pack’s saving against the dearest per-doc rate', () => {
    const { container } = render(
      <LanguageProvider>
        <PackList packs={DEMO_PACKS} onSelect={() => {}} />
      </LanguageProvider>
    )
    const saves = [...container.querySelectorAll('.pack-card')].map(
      card => card.querySelector('.pack-card-save')?.textContent?.match(/\d+/)?.[0] ?? null
    )
    // ฿450/100 = 4.50 is the dearest; 4.00 → 11%, 3.00 → 33%, 2.00 → 56%.
    expect(saves).toEqual([null, '11', '33', '56'])
  })
})
