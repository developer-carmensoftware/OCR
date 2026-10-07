import { useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '@/shared/hooks/useDialogFocus'
import { useScrollLock } from '@/shared/hooks/useScrollLock'

interface DialogProps {
  title: ReactNode
  children: ReactNode
  /** Buttons, start to end. A `.ui-dialog__spacer` pushes the rest to the end. */
  footer?: ReactNode
  /** A refusal from the server, shown above the body's content. */
  error?: ReactNode
  /** Escape and the backdrop call this. `null` = only the footer can close the dialog, for a
   *  step whose content would be lost (a secret shown once). */
  onDismiss: (() => void) | null
  initialFocus?: () => HTMLElement | null
  /** Accessible name for the backdrop button. */
  closeLabel?: string
  /** The dialog box, e.g. to refocus it after a refused save disabled the focused button. */
  ref?: RefObject<HTMLDivElement | null>
  className?: string
}

/**
 * The record dialog of DESIGN.md §5: portal, `aria-modal`, Tab kept inside, focus back to the
 * opener on close, 560px wide and full screen on a phone.
 *
 * ponytail: RuleDialog (EmailSettings) and PaymentMappingDialog predate this and keep their
 * own shells; move them here the next time either is touched.
 */
export default function Dialog({
  title,
  children,
  footer,
  error,
  onDismiss,
  initialFocus,
  closeLabel = 'Close',
  ref,
  className,
}: DialogProps) {
  const ownRef = useRef<HTMLDivElement>(null)
  const boxRef = ref ?? ownRef
  const titleId = useId()
  useScrollLock(true)
  useDialogFocus(boxRef, { initialFocus, onEscape: onDismiss })

  return createPortal(
    <div className="ui-dialog-overlay">
      <button
        type="button"
        className="ui-dialog-backdrop"
        aria-label={closeLabel}
        tabIndex={-1}
        onClick={onDismiss ?? undefined}
        disabled={!onDismiss}
      />
      <div
        ref={boxRef}
        className={`ui-dialog${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="ui-dialog__head">
          <h2 id={titleId} className="ui-dialog__title">
            {title}
          </h2>
        </header>
        <div className="ui-dialog__body">
          {error && (
            <p className="ui-dialog__error" role="alert">
              {error}
            </p>
          )}
          {children}
        </div>
        {footer && <footer className="ui-dialog__foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}
