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
 * Switching to a smaller tier is the buyer's call to make, so the CTA stays live —
 * the real confirmation is at slip upload, where money moves. What the card owes
 * them is a heads-up, and it cannot be a visible line: one taller card desyncs the
 * price row across the grid. These two tests pin both halves.
 */
describe('PlanCard plan-change state', () => {
  it('leaves the CTA clickable but says what a smaller-tier plan costs', () => {
    // Active plan allows 200 docs; Lite allows 100 → smaller tier.
    const { container } = renderCard({ activePlanCode: 'sub_starter', activePlanCredits: 200 })

    expect(screen.getByRole('button')).toBeEnabled()

    const tip = container.querySelector('.plan-cta-tip')
    expect(tip?.getAttribute('title')).toBe(
      'Switching now replaces your current plan — remaining documents and days are not carried over.'
    )

    // ...and the same sentence reaches assistive tech, at zero layout cost.
    const describedBy = screen.getByRole('button').getAttribute('aria-describedby')
    expect(describedBy).toBe('sub_lite-switch-note')
    expect(container.querySelector(`#${describedBy}`)?.className).toContain('sr-only')
  })

  it('leaves the CTA enabled and adds no hint when it is not a smaller tier', () => {
    const { container } = renderCard()

    expect(screen.getByRole('button')).toBeEnabled()
    expect(container.querySelector('.plan-cta-tip')?.hasAttribute('title')).toBe(false)
    expect(container.querySelector('.sr-only')).toBeNull()
  })
})

/**
 * The visible label is short so it fits one line at 4-up (~160px of card), but the
 * accessible name must stay tier-specific — otherwise a screen reader moving from
 * button to button hears "Change plan" three times with nothing to tell them apart.
 */
describe('PlanCard CTA label', () => {
  it('prints the action and names the tier for assistive tech', () => {
    // Active plan allows 50 docs; Lite allows 100 → bigger tier.
    renderCard({ activePlanCode: 'sub_starter', activePlanCredits: 50 })

    const cta = screen.getByRole('button', { name: 'Change to Lite' })
    expect(cta).toHaveTextContent('Change plan')
    expect(cta).not.toHaveTextContent('Change to Lite')
  })

  it('says Renew, not Change, on the tier already active', () => {
    renderCard({ activePlanCode: 'sub_lite', activePlanCredits: 100 })

    const cta = screen.getByRole('button', { name: 'Renew Lite' })
    expect(cta).toHaveTextContent('Renew plan')
  })

  // The same tier on the other billing period replaces the subscription rather than
  // extending it — `planChangeLoss` already reports that as a change, and the button
  // used to disagree because it matched on the plan code alone.
  it('says Change on the active tier when the billing period differs', () => {
    renderCard({
      activePlanCode: 'sub_lite',
      activePlanCredits: 100,
      activePlanPeriod: 'monthly',
      period: 'annual',
    })

    const cta = screen.getByRole('button', { name: 'Change to Lite' })
    expect(cta).toHaveTextContent('Change plan')
  })

  // Bigger and smaller tiers used to get different words ("Upgrade" vs a downgrade
  // word); giving only the bigger ones positive framing read as picking a side on a
  // screen about money. Both now render the identical neutral "Change" CTA.
  it('renders the same "Change" CTA whether the tier is bigger or smaller than the active plan', () => {
    renderCard({ activePlanCode: 'sub_starter', activePlanCredits: 200 })

    const cta = screen.getByRole('button', { name: 'Change to Lite' })
    expect(cta).toHaveTextContent('Change')
    expect(cta).not.toHaveTextContent('Upgrade')
  })
})
