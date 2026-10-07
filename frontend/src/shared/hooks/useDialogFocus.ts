import { useEffect, useRef, type RefObject } from 'react'

/** Every focusable element inside `root`, in DOM order — what Tab may land on. */
export const focusablesIn = (root: HTMLElement | null) =>
  [
    ...(root?.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]'
    ) ?? []),
  ].filter(el => el.tabIndex >= 0 && !el.hasAttribute('disabled'))

interface Options {
  /** What to focus on open. Defaults to the first focusable element, then the dialog. */
  initialFocus?: () => HTMLElement | null
  /** Called on Escape. `null` makes Escape inert — for a step that must be closed on purpose. */
  onEscape: (() => void) | null
}

/**
 * Keyboard contract of a modal dialog: focus moves in on open and back to the opener on
 * close (unmount), Tab stays inside, Escape calls `onEscape`.
 *
 * The listener sits on the document, not the dialog: a button disabled mid-save drops focus
 * to <body>, and a key pressed there would never reach the dialog's own handler. Tab from
 * outside the box comes back into it. Lifted from RuleDialog (EmailSettings), which still
 * carries its own copy, as does PaymentMappingDialog.
 */
export function useDialogFocus(dialogRef: RefObject<HTMLElement | null>, options: Options) {
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const target =
      latest.current.initialFocus?.() ?? focusablesIn(dialogRef.current)[0] ?? dialogRef.current
    target?.focus()
    return () => opener?.focus()
  }, [dialogRef])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const onEscape = latest.current.onEscape
        if (!onEscape) return
        e.preventDefault()
        onEscape()
        return
      }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      const stops = focusablesIn(root)
      if (!stops.length) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      const at = document.activeElement
      const outside = !root?.contains(at)
      if (outside || (e.shiftKey ? at === first || at === root : at === last)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialogRef])
}
