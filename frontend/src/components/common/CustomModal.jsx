import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

const TYPE_CONFIG = {
  success: {
    Icon: CheckCircle2,
    gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    glow: 'rgba(5, 150, 105, 0.25)',
    bar: 'linear-gradient(90deg, #059669, #34d399)',
    btn: { background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' },
  },
  warning: {
    Icon: AlertTriangle,
    gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
    glow: 'rgba(217, 119, 6, 0.22)',
    bar: 'linear-gradient(90deg, #d97706, #fbbf24)',
    btn: { background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', boxShadow: '0 4px 14px rgba(217,119,6,0.35)' },
  },
  error: {
    Icon: XCircle,
    gradient: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)',
    glow: 'rgba(220, 38, 38, 0.22)',
    bar: 'linear-gradient(90deg, #dc2626, #f87171)',
    btn: { background: 'linear-gradient(135deg, #dc2626 0%, #e11d48 100%)', boxShadow: '0 4px 14px rgba(220,38,38,0.35)' },
  },
  info: {
    Icon: Info,
    gradient: 'linear-gradient(135deg, #8058F1 0%, #6366f1 100%)',
    glow: 'rgba(128, 88, 241, 0.22)',
    bar: 'linear-gradient(90deg, #8058F1, #818cf8, #197CDD)',
    btn: { background: 'linear-gradient(135deg, #8058F1 0%, #6366f1 100%)', boxShadow: '0 4px 14px rgba(128,88,241,0.35)' },
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
  const cancelRef  = useRef(null)
  const inputRef   = useRef(null)
  const [inputVal, setInputVal] = useState('')

  useEffect(() => {
    if (show) setInputVal(inputValue || '')
  }, [show, inputLabel])

  const handleInputChange = (v) => {
    setInputVal(v)
    onInputChange?.(v)
  }

  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => {
      if (inputLabel && inputRef.current) inputRef.current.focus()
      else confirmRef.current?.focus()
    }, 50)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onCancel ? onCancel() : onConfirm?.(); return }
      if (e.key !== 'Tab') return
      const focusable = [cancelRef.current, inputRef.current, confirmRef.current].filter(Boolean)
      if (!focusable.length) return
      if (e.shiftKey) {
        if (document.activeElement === focusable[0]) { e.preventDefault(); focusable[focusable.length - 1].focus() }
      } else {
        if (document.activeElement === focusable[focusable.length - 1]) { e.preventDefault(); focusable[0].focus() }
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
            {/* Gradient accent bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
              background: cfg.bar,
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
            }} />

            {/* Icon */}
            <div style={{
              width: 64, height: 64,
              borderRadius: '18px',
              background: cfg.gradient,
              boxShadow: `0 8px 28px ${cfg.glow}, 0 0 0 6px ${cfg.glow.replace('0.22', '0.10')}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
              color: 'white',
            }}>
              <cfg.Icon size={30} strokeWidth={2} />
            </div>

            <h3 className="modal-title" id="modal-title">{title}</h3>
            <p className="modal-msg" id="modal-desc">{message}</p>

            {inputLabel && (
              <div style={{ margin: '0.25rem 0 1rem', textAlign: 'left' }}>
                <label style={{
                  display: 'block', fontSize: '0.72rem', fontWeight: 700,
                  color: 'var(--text-2)', marginBottom: '0.35rem',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {inputLabel}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={e => handleInputChange(e.target.value)}
                  placeholder={inputPlaceholder || ''}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '0.55rem 0.85rem', fontSize: '0.9rem',
                    border: '1.5px solid var(--border)', borderRadius: '8px',
                    background: 'var(--bg-2, #f9fafb)', color: 'var(--text)',
                    outline: 'none',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            )}

            <div className="modal-actions">
              {onCancel && (
                <button ref={cancelRef} className="btn btn-outline" style={cancelStyle} onClick={onCancel}>
                  {cancelText}
                </button>
              )}
              <button
                ref={confirmRef}
                className="btn"
                style={{ color: 'white', ...cfg.btn }}
                onClick={onConfirm}
              >
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
