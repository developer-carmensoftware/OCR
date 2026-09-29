import { useMemo } from 'react'
import { TutorialModal, type TutorialStep } from '@/shared/components/tutorial'
import { useT } from '@/i18n/LanguageContext'
import type { CreditPack } from '@/shared/api/credits'
import { purchaseTutorial } from './purchase'
import { PURCHASE_FIGURE_WIDTHS, purchaseFigures } from './screens'

/**
 * "How to buy a package" — the purchase flow's tutorial.
 *
 * All this does is marry copy (features/billing/components/tutorial/purchase.ts) to figures
 * (./screens.tsx) and hand them to the shared modal. A second module's tutorial
 * is this file again with its own two imports.
 *
 * `plans` / `packs` are the catalog the pricing page already loaded: every price the
 * tour quotes or draws comes from them, so it always matches the page behind it.
 */
export default function PurchaseTutorial({
  open,
  onClose,
  plans,
  packs,
}: {
  open: boolean
  onClose: () => void
  plans: CreditPack[]
  packs: CreditPack[]
}) {
  const { t } = useT()

  const steps = useMemo<TutorialStep[]>(() => {
    const figures = purchaseFigures({ plans, packs })
    return purchaseTutorial({ plans, packs }).map(step => ({
      ...step,
      figure: figures[step.screen - 1],
      canvasWidth: PURCHASE_FIGURE_WIDTHS[step.screen - 1],
    }))
  }, [plans, packs])

  return (
    <TutorialModal
      open={open}
      onClose={onClose}
      title={t('tutorial.title')}
      steps={steps}
      // The last step's call to action is simply "stop reading and go pick one" —
      // the catalog is already behind this modal, and TutorialModal closes itself.
      finish={{ label: t('tutorial.buyPackage') }}
    />
  )
}
