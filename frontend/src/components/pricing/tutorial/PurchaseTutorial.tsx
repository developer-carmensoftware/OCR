import { useMemo } from 'react'
import { TutorialModal, type TutorialStep } from '../../tutorial'
import { useT } from '../../../i18n/LanguageContext'
import { PURCHASE_TUTORIAL } from '../../../content/tutorials/purchase'
import { PURCHASE_FIGURES, PURCHASE_FIGURE_WIDTHS } from './screens'

/**
 * "How to buy a package" — the purchase flow's tutorial.
 *
 * All this does is marry copy (content/tutorials/purchase.ts) to figures
 * (./screens.tsx) and hand them to the shared modal. A second module's tutorial
 * is this file again with its own two imports.
 */
export default function PurchaseTutorial({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { t } = useT()

  const steps = useMemo<TutorialStep[]>(
    () =>
      PURCHASE_TUTORIAL.map(step => ({
        ...step,
        figure: PURCHASE_FIGURES[step.screen - 1],
        canvasWidth: PURCHASE_FIGURE_WIDTHS[step.screen - 1],
      })),
    []
  )

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
