import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SpotProvider } from '@/shared/components/tutorial/Spot'
import { spotTarget } from '@/shared/components/tutorial/useCamera'
import { purchaseFigures } from './screens'
import { purchaseTutorial } from './purchase'
import { DEMO_PACKS, DEMO_PLANS } from './fixtures'

const CATALOG = { plans: DEMO_PLANS, packs: DEMO_PACKS }
const PURCHASE_FIGURES = purchaseFigures(CATALOG)
const PURCHASE_TUTORIAL = purchaseTutorial(CATALOG)
const FOCUS_STEPS = PURCHASE_TUTORIAL.map((s, i) => ({ ...s, n: i + 1 })).filter(s => s.spot)

/**
 * A step's `spot` and the thing it points at are two strings in two files that
 * have to agree. When they stop agreeing nothing throws — the camera just frames
 * the whole page as if the step were an overview. This is that check.
 */
describe('purchase tutorial figures', () => {
  it.each(FOCUS_STEPS.map(s => [s.n, s.screen, s.spot!] as const))(
    'step %i, on figure %i, frames %s',
    (_step, screen, spot) => {
      const { container } = render(
        <SpotProvider value={spot}>{PURCHASE_FIGURES[screen - 1]}</SpotProvider>
      )
      // Resolved the same way the camera resolves it: a <Spot> marker, or a
      // selector for product markup the figure mounts rather than redraws.
      expect(spotTarget(container, spot)).not.toBeNull()
    }
  )

  it('has an overview step before the first focus step of each screen', () => {
    const firstOfScreen = new Map<number, boolean>()
    for (const step of PURCHASE_TUTORIAL) {
      if (!firstOfScreen.has(step.screen)) firstOfScreen.set(step.screen, !step.spot)
    }
    // Screens 1, 2 and 4 are full pages and open with an overview. Screens 3, 5
    // and 6 are a single card each — framing them IS the overview.
    expect(firstOfScreen.get(1)).toBe(true)
    expect(firstOfScreen.get(2)).toBe(true)
    expect(firstOfScreen.get(4)).toBe(true)
  })

  /**
   * The figures mount the product rather than imitating it. These assert the
   * real components actually rendered — a `<Spot>` alone would still pass if
   * everything inside it had failed to mount.
   */
  it('renders the real plan cards and pack list on the catalog figure', () => {
    const { container } = render(<SpotProvider value="">{PURCHASE_FIGURES[1]}</SpotProvider>)
    expect(container.querySelectorAll('.plan-card')).toHaveLength(4)
    expect(container.querySelector('.enterprise-band')).not.toBeNull()
    expect(container.querySelector('.pack-grid, .pack-list')).not.toBeNull()
  })

  it('renders the real proforma document', () => {
    const { container } = render(<SpotProvider value="">{PURCHASE_FIGURES[3]}</SpotProvider>)
    expect(container.querySelector('.proforma-doc')).not.toBeNull()
    expect(container.querySelector('.pf-toolbar')).not.toBeNull()
  })

  /**
   * The last step narrates "check the file, then Confirm payment", so the figure
   * has to be past the drop zone — that only happens because `DEMO_SLIP` seeds
   * SlipUpload (the canvas is inert; nothing there can pick a file).
   */
  it('renders the pending-order banner with the slip already attached', () => {
    const { container } = render(<SpotProvider value="">{PURCHASE_FIGURES[4]}</SpotProvider>)
    expect(container.querySelector('.order-pending-banner')).not.toBeNull()
    expect(container.querySelector('.slip-chosen')).not.toBeNull()
    expect(container.querySelector('.slip-submit')).not.toBeNull()
    expect(container.querySelector('.slip-drop')).toBeNull()
  })

  /**
   * The tour used to type its prices and had drifted from the catalog (no Lite, no
   * Micro). Every price line is now written from the catalog it is given.
   */
  it('quotes every price from the catalog, not from its own copy', () => {
    const step = (spot: string) => PURCHASE_TUTORIAL.find(s => s.spot === spot)!
    const topup = step('topup-credits').en.body.join(' ')
    expect(topup).toContain('**100 Credits:** ฿450 (฿4.50 per page on average)')
    expect(topup).toContain('**10,000 Credits:** ฿20,000 (฿2.00 per page on average)')

    const monthly = step('monthly-plans')
    expect(monthly.en.body).toContain('• **Lite:** 100 documents / month (฿290 / month)')
    // 10% is read off price_annual_thb (3,132 = 290 × 12 × 0.9), not typed.
    expect(monthly.th.body.join(' ')).toContain('ส่วนลด **10%**')

    const cheaper = purchaseTutorial({
      plans: DEMO_PLANS,
      packs: [{ ...DEMO_PACKS[0], price_thb: 400 }],
    })
    expect(cheaper.find(s => s.spot === 'topup-credits')!.en.body.join(' ')).toContain('฿400')
  })
})
