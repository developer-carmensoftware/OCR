import { useRef, useState } from 'react'
import { PDF_PASSWORD_REQUIRED, type ApiError } from '../lib/api/ocr'

/**
 * CustomModal-compatible payload the host modal system renders. The two wizards
 * adapt their own modal API to accept this (`showModal(p)` vs `setModal({show:true,...p})`).
 */
export interface PdfPasswordModalPayload {
  type: 'warning'
  title: string
  message: string
  confirmText: string
  cancelText: string
  busy?: boolean
  errorNonce: number
  inputLabel: string
  inputType: 'password'
  inputPlaceholder: string
  inputValue: string
  onInputChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
  // Index signature keeps this assignable to the hosts' modal-config types
  // (ModalConfig / ModalState), which both carry one.
  [key: string]: unknown
}

export interface PdfPasswordAttempt {
  /**
   * Validate the password — e.g. call `/pdf-info`. Reject with an ApiError whose
   * `code === PDF_PASSWORD_REQUIRED` when the password is wrong (the prompt then
   * shakes and re-asks). Resolve with anything the caller needs in `onVerified`.
   */
  verify: (password: string) => Promise<unknown>
  /** Runs once the password is accepted, AFTER the modal has closed. */
  onVerified: (password: string, result: unknown) => void
  /** Runs after the modal closes when verify fails for a non-password reason. */
  onError?: (password: string, err: unknown) => void
}

interface Options {
  openModal: (payload: PdfPasswordModalPayload) => void
  closeModal: () => void
  /** Cleanup when the user cancels the prompt (clear the pending file/preview). */
  onCancel: () => void
}

const COPY = {
  title: 'Password-Protected PDF',
  intro: 'This PDF is locked. Enter its password to continue — nothing is stored after processing.',
  checking: 'Checking password…',
  wrong: 'Incorrect password — please try again.',
  empty: 'Please enter the PDF password.',
}

/**
 * Owns the entire password-prompt UX state machine — prompt → verifying (busy) →
 * wrong-password re-prompt (shake + keep the typed value) → success (single clean
 * close). Domain routing (single vs multi-page, what to extract) lives in the
 * caller's `attempt`, so both the Credit Card and AP wizards share one flow.
 */
export function usePdfPasswordPrompt({ openModal, closeModal, onCancel }: Options) {
  const [pdfPassword, setPdfPassword] = useState('')
  // The in-flight typed password (read synchronously on confirm) — never React state,
  // so typing never re-renders the host and steals focus.
  const inputRef = useRef('')
  // Monotonic; each bump re-triggers the modal's shake-on-wrong feedback.
  const nonceRef = useRef(0)
  // The active attempt, held across the open → confirm → verify lifecycle.
  const attemptRef = useRef<PdfPasswordAttempt | null>(null)

  // `render` references `submit` (hoisted function declarations make the cycle legal).
  function render(opts: { error?: string; busy?: boolean; reset?: boolean }) {
    openModal({
      type: 'warning',
      title: COPY.title,
      message: opts.busy ? COPY.checking : opts.error || COPY.intro,
      confirmText: 'Unlock',
      cancelText: 'Cancel',
      busy: opts.busy,
      errorNonce: opts.error ? (nonceRef.current += 1) : 0,
      inputLabel: 'PDF Password',
      inputType: 'password',
      inputPlaceholder: 'Enter password',
      // Keep what the user typed (so they can see and fix it); clear only on a fresh open.
      inputValue: opts.reset ? '' : inputRef.current,
      onInputChange: (v: string) => {
        inputRef.current = v
      },
      onConfirm: submit,
      onCancel: () => {
        closeModal()
        onCancel()
      },
    })
  }

  function prompt(error?: string) {
    // Fresh open clears the field; a wrong-password re-prompt keeps it for editing.
    if (!error) inputRef.current = ''
    render({ error, reset: !error })
  }

  async function submit() {
    const attempt = attemptRef.current
    if (!attempt) return
    const password = inputRef.current
    if (!password) {
      prompt(COPY.empty)
      return
    }
    // Switch the open modal to its verifying state — no close, so no flicker.
    render({ busy: true })
    try {
      const result = await attempt.verify(password)
      setPdfPassword(password)
      closeModal()
      attempt.onVerified(password, result)
    } catch (err) {
      if ((err as ApiError).code === PDF_PASSWORD_REQUIRED) {
        // Stay open, swap the message inline (modal never unmounts).
        prompt(COPY.wrong)
        return
      }
      closeModal()
      attempt.onError?.(password, err)
    }
  }

  /** Open the prompt for an encrypted PDF. `attempt` validates + routes. */
  function open(attempt: PdfPasswordAttempt) {
    attemptRef.current = attempt
    prompt()
  }

  /** Clear the remembered password (on cancel / new upload / reset). */
  function reset() {
    inputRef.current = ''
    attemptRef.current = null
    setPdfPassword('')
  }

  return { open, reset, pdfPassword }
}
