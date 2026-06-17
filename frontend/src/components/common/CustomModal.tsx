import { useEffect, useRef, useState, CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Info, Loader2, Eye, EyeOff } from 'lucide-react'

type ModalType = 'info' | 'success' | 'warning' | 'error' | 'loading'

const TYPE_CONFIG = {
  success: { Icon: CheckCircle2 },
  warning: { Icon: AlertTriangle },
  error: { Icon: XCircle },
  info: { Icon: Info },
} as const

interface Props {
  show: boolean
  title?: string
  message?: string
  type?: ModalType
  onConfirm?: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
  cancelStyle?: CSSProperties
  inputLabel?: string
  inputValue?: string
  onInputChange?: (v: string) => void
  inputPlaceholder?: string
  inputType?: 'text' | 'password'
  /** Async-in-progress state: disables the input + actions and shows a spinner on confirm. */
  busy?: boolean
  /** Bump this to a new value to flag the input as invalid: shakes it and turns it red. */
  errorNonce?: number
}

export default function CustomModal({
  show,
  title,
  message,
  type = 'info',
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  cancelStyle,
  inputLabel,
  inputValue,
  onInputChange,
  inputPlaceholder,
  inputType = 'text',
  busy = false,
  errorNonce = 0,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputVal, setInputVal] = useState('')
  const [inputErrored, setInputErrored] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const shakeControls = useAnimationControls()
  const reduceMotion = useReducedMotion()
  const isPassword = inputType === 'password'

  useEffect(() => {
    if (show) setInputVal(inputValue || '')
  }, [show, inputLabel, inputValue])

  // Reset the invalid + reveal state whenever the dialog (re)opens.
  useEffect(() => {
    if (show) {
      setInputErrored(false)
      setRevealed(false)
    }
  }, [show])

  // A new errorNonce means "this attempt was wrong" — flag red and shake the field.
  // Re-runs on every bump so consecutive wrong tries each get their own shake.
  useEffect(() => {
    if (!errorNonce) return
    setInputErrored(true)
    if (!reduceMotion) {
      shakeControls.start({
        x: [0, -8, 8, -6, 6, -3, 3, 0],
        transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorNonce])

  const handleInputChange = (v: string) => {
    setInputVal(v)
    if (inputErrored) setInputErrored(false)
    onInputChange?.(v)
  }

  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => {
      if (inputLabel && inputRef.current) inputRef.current.focus()
      else confirmRef.current?.focus()
    }, 50)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (busy) return
      if (e.key === 'Escape') {
        if (onCancel) onCancel()
        else if (onConfirm) onConfirm()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = [cancelRef.current, inputRef.current, confirmRef.current].filter(
        Boolean
      ) as HTMLElement[]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [show, onCancel, onConfirm, inputLabel, busy])

  if (type === 'loading') {
    return show
      ? createPortal(
          <div className="ocr-loading-overlay">
            <div className="ocr-loading-box">
              <div className="ocr-loading-spinner" />
              <div className="ocr-loading-title">{title}</div>
              {message && <div className="ocr-loading-status">{message}</div>}
            </div>
          </div>,
          document.body
        )
      : null
  }

  const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-desc"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className={`modal-box modal-${type}`}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 28,
              opacity: { duration: 0.15 },
            }}
          >
            <div className="modal-icon-wrapper">
              <cfg.Icon size={26} strokeWidth={1.75} />
            </div>
            <h3 className="modal-title" id="modal-title">
              {title}
            </h3>
            <p className="modal-msg" id="modal-desc">
              {message}
            </p>

            {inputLabel && (
              <motion.div className="modal-input-group" animate={shakeControls}>
                <label className="modal-input-label">{inputLabel}</label>
                <div className="modal-input-wrap">
                  <input
                    ref={inputRef}
                    type={isPassword && !revealed ? 'password' : 'text'}
                    value={inputVal}
                    disabled={busy}
                    aria-invalid={inputErrored || undefined}
                    onChange={e => handleInputChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !busy) {
                        e.preventDefault()
                        onConfirm?.()
                      }
                    }}
                    placeholder={inputPlaceholder || ''}
                    aria-label={inputLabel}
                    className={`modal-input${isPassword ? ' modal-input--with-reveal' : ''}${
                      inputErrored ? ' modal-input--error' : ''
                    }`}
                  />
                  {isPassword && (
                    <button
                      type="button"
                      className="modal-input-reveal"
                      onClick={() => setRevealed(r => !r)}
                      disabled={busy}
                      tabIndex={-1}
                      aria-label={revealed ? 'Hide password' : 'Show password'}
                      title={revealed ? 'Hide password' : 'Show password'}
                    >
                      {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            <div className="modal-actions">
              {onCancel && (
                <button
                  ref={cancelRef}
                  type="button"
                  className="btn btn-outline"
                  style={cancelStyle}
                  onClick={onCancel}
                  disabled={busy}
                >
                  {cancelText}
                </button>
              )}
              <button
                ref={confirmRef}
                type="button"
                className="btn btn-confirm"
                onClick={onConfirm}
                disabled={busy}
              >
                {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
