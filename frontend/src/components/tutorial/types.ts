import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Lang } from '../../i18n/dict'

/** One step's narration, in one language. */
export interface TutorialStepCopy {
  /** Short label for the step, shown in the step list / tooltip. */
  title: string
  /** Headline of the narration pane. */
  heading: string
  /**
   * One paragraph per entry. A line starting with the bullet character renders
   * as a bullet, and `**text**` renders bold — see `boldify` in TutorialModal.
   * Deliberately not HTML: nothing here goes near dangerouslySetInnerHTML.
   */
  body: string[]
}

/**
 * A step as a module author writes it: which element to spotlight, an icon, and
 * the copy in every supported language. `Record<Lang, …>` is what makes the
 * compiler ask for Thai, the same guarantee `i18n/dict.ts` gives.
 */
export type TutorialStepDefinition = {
  /**
   * What the camera frames. The `id` of a `<Spot>` in this step's figure, or a
   * plain CSS selector for product markup a figure cannot wrap.
   *
   * **Omit it for an overview step**: the whole figure, fitted, nothing
   * highlighted. Open a screen with one, then zoom into its parts.
   */
  spot?: string
  icon: LucideIcon
} & Record<Lang, TutorialStepCopy>

/** A step ready to render: a definition plus the illustration it points at. */
export interface TutorialStep extends TutorialStepDefinition {
  figure: ReactNode
  /**
   * The width the figure's page lays out at, defaulting to 1080 (the pricing
   * page's max-width). Give it the max-width of whatever container the real
   * screen uses — a module in `.app-container` is 1480, and laying it out
   * narrower squeezes a header that has room to spare on the real screen.
   */
  canvasWidth?: number
}
