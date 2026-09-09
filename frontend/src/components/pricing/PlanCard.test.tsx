// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { PlanCard } from './PlanCard'
import { PLAN_META } from '../../constants/billing'
import type { CreditPack } from '../../lib/api/credits'

const LITE: CreditPack = {
  code: 'sub_lite',
  kind: 'subscription',
  credits: 100,
  price_thb: 290,
  price_annual_thb: 3132,
  sort_order: 0,
}

function renderCard(props: Partial<Parameters<typeof PlanCard>[0]> = {}) {
  return render(
    <LanguageProvider>
      <PlanCard pack={LITE} meta={PLAN_META.sub_lite} onSelect={() => {}} {...props} />
    </LanguageProvider>
  )
}

/**
 * Adding Lite put a tier BELOW Starter, so every existing subscriber now meets a
 * disabled card on their first visit. A disabled CTA that does not say why reads
 * as a bug — and the reason cannot be a visible line, because one taller card
 * desyncs the price row across the grid. These two tests pin both halves.
 */
describe('PlanCard downgrade state', () => {
  it('disables the CTA and gives the reason when the tier is a downgrade', () => {
    // Active plan allows 200 docs; Lite allows 100 → downgrade.
    const { container } = renderCard({ activePlanCode: 'sub_starter', activePlanCredits: 200 })

    expect(screen.getByRole('button')).toBeDisabled()

    // The hint hangs off the wrapper: a disabled button suppresses its own title.
    const tip = container.querySelector('.plan-cta-tip')
    expect(tip?.getAttribute('title')).toBe('Downgrading is available when your current plan ends.')

    // ...and the same sentence reaches assistive tech, at zero layout cost.
    const describedBy = screen.getByRole('button').getAttribute('aria-describedby')
    expect(describedBy).toBe('sub_lite-downgrade')
    expect(container.querySelector(`#${describedBy}`)?.className).toContain('sr-only')
  })

  it('leaves the CTA enabled and adds no hint when it is not a downgrade', () => {
    const { container } = renderCard()

    expect(screen.getByRole('button')).toBeEnabled()
    expect(container.querySelector('.plan-cta-tip')?.hasAttribute('title')).toBe(false)
    expect(container.querySelector('.sr-only')).toBeNull()
  })
})

/**
 * The visible label is short so it fits one line at 4-up (~160px of card), but the
 * accessible name must stay tier-specific — otherwise a screen reader moving from
 * button to button hears "Upgrade plan" four times with nothing to tell them apart.
 */
describe('PlanCard CTA label', () => {
  it('prints the action and names the tier for assistive tech', () => {
    renderCard({ activePlanCode: 'sub_starter', activePlanCredits: 50 })

    const cta = screen.getByRole('button', { name: 'Upgrade to Lite' })
    expect(cta).toHaveTextContent('Upgrade plan')
    expect(cta).not.toHaveTextContent('Upgrade to Lite')
  })

  it('says Renew, not Upgrade, on the tier already active', () => {
    renderCard({ activePlanCode: 'sub_lite', activePlanCredits: 100 })

    const cta = screen.getByRole('button', { name: 'Renew Lite' })
    expect(cta).toHaveTextContent('Renew plan')
  })

  // Lite put a tier below Starter, so this branch is now on every subscriber's
  // first card. Calling a downgrade an upgrade is wrong on a screen about money.
  it('calls a smaller tier a downgrade, never an upgrade', () => {
    renderCard({ activePlanCode: 'sub_starter', activePlanCredits: 200 })

    const cta = screen.getByRole('button', { name: 'Downgrade to Lite' })
    expect(cta).toHaveTextContent('Downgrade')
    expect(cta).not.toHaveTextContent('Upgrade')
  })
})
