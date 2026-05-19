import { useEffect, useRef, useState, CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

type ModalType = 'info' | 'success' | 'warning' | 'error' | 'loading'

const TYPE_CONFIG = {
  success: { Icon: CheckCircle2 },
  warning: { Icon: AlertTriangle },
  error:   { Icon: XCircle },
  info:    { Icon: Info },
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
}

export default function CustomModal({
  show, title, message, type = 'info',
  onConfirm, onCancel,
  confirmText = 'OK', cancelText = 'Cancel',
  cancelStyle,
  inputLabel, inputValue, onInputChange, inputPlaceholder,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputVal, setInputVal] = useState('')

  useEffect(() => {
    if (show) setInputVal(inputValue || '')
  }, [show, inputLabel, inputValue])

  const handleInputChange = (v: string) => {
    setInputVal(v)
    onInputChange?.(v)
  }

  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => {
      if (inputLabel && inputRef.current) inputRef.current.focus()
      else confirmRef.current?.focus()
    }, 50)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCancel) onCancel()
        else if (onConfirm) onConfirm()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = [cancelRef.current, inputRef.current, confirmRef.current].filter(Boolean) as HTMLElement[]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => { clearTimeout(timer); document.removeEventListener('keydown', handleKeyDown) }
  }, [show, onCancel, onConfirm, inputLabel])

  if (type === 'loading') {
    return show ? createPortal(
      <div className="ocr-loading-overlay">
        <div className="ocr-loading-box">
          <div className="ocr-loading-spinner" />
          <div className="ocr-loading-title">{title}</div>
          {message && <div className="ocr-loading-status">{message}</div>}
        </div>
      </div>,
      document.body
    ) : null
  }

  const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-desc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <motion.div className={`modal-box modal-${type}`} initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
            <div className="modal-icon-wrapper">
              <cfg.Icon size={26} strokeWidth={1.75} />
            </div>
            <h3 className="modal-title" id="modal-title">{title}</h3>
            <p className="modal-msg" id="modal-desc">{message}</p>

            {inputLabel && (
              <div className="modal-input-group">
                <label className="modal-input-label">
                  {inputLabel}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={e => handleInputChange(e.target.value)}
                  placeholder={inputPlaceholder || ''}
                  aria-label={inputLabel}
                  className="modal-input"
                />
              </div>
            )}

            <div className="modal-actions">
              {onCancel && (
                <button ref={cancelRef} type="button" className="btn btn-outline" style={cancelStyle} onClick={onCancel}>
                  {cancelText}
                </button>
              )}
              <button ref={confirmRef} type="button" className="btn btn-confirm" onClick={onConfirm}>
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
