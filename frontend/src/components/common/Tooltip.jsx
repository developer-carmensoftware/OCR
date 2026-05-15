import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

const GAP = 10 // px gap between trigger edge and tooltip

function getCoords(rect, position) {
  switch (position) {
    case 'bottom':
      return {
        top: rect.bottom + GAP,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
      }
    case 'bottom-left':
      return { top: rect.bottom + GAP, left: rect.right, transform: 'translateX(-100%)' }
    case 'bottom-right':
      return { top: rect.bottom + GAP, left: rect.left, transform: 'none' }
    case 'top':
      return {
        top: rect.top - GAP,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%) translateY(-100%)',
      }
    case 'top-left':
      return {
        top: rect.top - GAP,
        left: rect.right,
        transform: 'translateX(-100%) translateY(-100%)',
      }
    case 'top-right':
      return { top: rect.top - GAP, left: rect.left, transform: 'translateY(-100%)' }
    case 'left':
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - GAP,
        transform: 'translateX(-100%) translateY(-50%)',
      }
    case 'right':
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + GAP,
        transform: 'translateY(-50%)',
      }
    default:
      return {
        top: rect.top - GAP,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%) translateY(-100%)',
      }
  }
}

export default function Tooltip({ text, children, position = 'top' }) {
  const [state, setState] = useState({ visible: false, top: 0, left: 0, transform: 'none' })
  const triggerRef = useRef(null)

  if (!text) return children

  const show = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const coords = getCoords(rect, position)
    setState({ visible: true, ...coords })
  }

  const hide = () => setState(s => ({ ...s, visible: false }))

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        {children}
      </div>

      {createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: state.top,
            left: state.left,
            transform: state.transform,
            background: 'rgba(15, 10, 40, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: '#e2e8f0',
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 500,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            zIndex: 99999,
            pointerEvents: 'none',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
            opacity: state.visible ? 1 : 0,
            visibility: state.visible ? 'visible' : 'hidden',
            transition: 'opacity 0.15s ease',
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  )
}
