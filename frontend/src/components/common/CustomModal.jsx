import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

const TYPE_CONFIG = {
  success: {
    Icon: CheckCircle2,
    iconBg: 'var(--emerald-light)',
    iconBorder: 'var(--emerald)',
    iconColor: 'var(--emerald)',
    btn: { background: 'var(--emerald)', color: 'white' },
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: 'var(--amber-light)',
    iconBorder: 'var(--amber)',
    iconColor: 'var(--amber)',
    btn: { background: 'var(--amber)', color: 'white' },
  },
  error: {
    Icon: XCircle,
    iconBg: 'var(--rose-light)',
    iconBorder: 'var(--rose)',
    iconColor: 'var(--rose)',
    btn: { background: 'var(--rose)', color: 'white' },
  },
  info: {
    Icon: Info,
    iconBg: 'var(--primary-light)',
    iconBorder: 'var(--primary)',
    iconColor: 'var(--primary)',
    btn: { background: 'var(--primary)', color: 'white' },
  },
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
}) {
  const confirmRef = useRef(null)
  const cancelRef = useRef(null)
  const inputRef = useRef(null)
  const [inputVal, setInputVal] = useState('')

  useEffect(() => {
    if (show) setInputVal(inputValue || '')
  }, [show, inputLabel])

  const handleInputChange = v => {
    setInputVal(v)
    onInputChange?.(v)
  }

  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => {
      if (inputLabel && inputRef.current) inputRef.current.focus()
      else confirmRef.current?.focus()
    }, 50)
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        onCancel ? onCancel() : onConfirm?.()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = [cancelRef.current, inputRef.current, confirmRef.current].filter(Boolean)
      if (!focusable.length) return
      if (e.shiftKey) {
        if (document.activeElement === focusable[0]) {
          e.preventDefault()
          focusable[focusable.length - 1].focus()
        }
      } else {
        if (document.activeElement === focusable[focusable.length - 1]) {
          e.preventDefault()
          focusable[0].focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [show, onCancel, onConfirm, inputLabel])

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

  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.info

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
            className="modal-box"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Icon */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 'var(--radius-md)',
                background: cfg.iconBg,
                border: `1.5px solid ${cfg.iconBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                color: cfg.iconColor,
              }}
            >
              <cfg.Icon size={26} strokeWidth={1.75} />
            </div>

            <h3 className="modal-title" id="modal-title">
              {title}
            </h3>
            <p className="modal-msg" id="modal-desc">
              {message}
            </p>

            {inputLabel && (
              <div style={{ margin: '0.25rem 0 1rem', textAlign: 'left' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--text-2)',
                    marginBottom: '0.35rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {inputLabel}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={e => handleInputChange(e.target.value)}
                  placeholder={inputPlaceholder || ''}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.9rem',
                    border: '1.5px solid var(--border)',
                    borderRadius: '8px',
                    background: 'var(--bg-2, #f9fafb)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--primary)'
                    e.target.style.boxShadow = '0 0 0 3px var(--primary-light)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--border)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            )}

            <div className="modal-actions">
              {onCancel && (
                <button
                  ref={cancelRef}
                  className="btn btn-outline"
                  style={cancelStyle}
                  onClick={onCancel}
                >
                  {cancelText}
                </button>
              )}
              <button ref={confirmRef} className="btn" style={{ ...cfg.btn }} onClick={onConfirm}>
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
