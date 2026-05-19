import { useEffect, useRef, useState, CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

type ModalType = 'info' | 'success' | 'warning' | 'error' | 'loading'

const TYPE_CONFIG = {
  success: { Icon: CheckCircle2, iconBg: 'var(--emerald-light)', iconBorder: 'var(--emerald)', iconColor: 'var(--emerald)', btn: { background: 'var(--emerald)', color: 'white' } },
  warning: { Icon: AlertTriangle, iconBg: 'var(--amber-light)', iconBorder: 'var(--amber)', iconColor: 'var(--amber)', btn: { background: 'var(--amber)', color: 'white' } },
  error:   { Icon: XCircle,       iconBg: 'var(--rose-light)',   iconBorder: 'var(--rose)',   iconColor: 'var(--rose)',   btn: { background: 'var(--rose)', color: 'white' } },
  info:    { Icon: Info,           iconBg: 'var(--primary-light)',iconBorder: 'var(--primary)',iconColor: 'var(--primary)',btn: { background: 'var(--primary)', color: 'white' } },
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
          <motion.div className="modal-box" initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
            <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-md)', background: cfg.iconBg, border: `1.5px solid ${cfg.iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: cfg.iconColor }}>
              <cfg.Icon size={26} strokeWidth={1.75} />
            </div>
            <h3 className="modal-title" id="modal-title">{title}</h3>
            <p className="modal-msg" id="modal-desc">{message}</p>

            {inputLabel && (
              <div style={{ margin: '0.25rem 0 1rem', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {inputLabel}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={e => handleInputChange(e.target.value)}
                  placeholder={inputPlaceholder || ''}
                  aria-label={inputLabel}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.85rem', fontSize: '0.9rem', border: '1.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-2, #f9fafb)', color: 'var(--text)', outline: 'none' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-light)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            )}

            <div className="modal-actions">
              {onCancel && (
                <button ref={cancelRef} type="button" className="btn btn-outline" style={cancelStyle} onClick={onCancel}>
                  {cancelText}
                </button>
              )}
              <button ref={confirmRef} type="button" className="btn" style={{ ...cfg.btn }} onClick={onConfirm}>
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
