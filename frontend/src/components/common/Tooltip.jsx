import { useState } from 'react'

export default function Tooltip({ text, children, position = 'top' }) {
  const [show, setShow] = useState(false)

  const getPositionStyles = () => {
    const baseOffset = 4
    const hoverOffset = 8
    
    switch (position) {
      case 'top': 
        return { bottom: show ? `calc(100% + ${hoverOffset}px)` : `calc(100% + ${baseOffset}px)`, left: '50%', transform: 'translateX(-50%)' }
      case 'bottom': 
        return { top: show ? `calc(100% + ${hoverOffset}px)` : `calc(100% + ${baseOffset}px)`, left: '50%', transform: 'translateX(-50%)' }
      case 'bottom-left': 
        return { top: show ? `calc(100% + ${hoverOffset}px)` : `calc(100% + ${baseOffset}px)`, right: 0, transform: 'none' }
      case 'bottom-right': 
        return { top: show ? `calc(100% + ${hoverOffset}px)` : `calc(100% + ${baseOffset}px)`, left: 0, transform: 'none' }
      case 'right': 
        return { left: show ? `calc(100% + ${hoverOffset}px)` : `calc(100% + ${baseOffset}px)`, top: '50%', transform: 'translateY(-50%)' }
      case 'left': 
        return { right: show ? `calc(100% + ${hoverOffset}px)` : `calc(100% + ${baseOffset}px)`, top: '50%', transform: 'translateY(-50%)' }
      case 'top-right': 
        return { bottom: show ? `calc(100% + ${hoverOffset}px)` : `calc(100% + ${baseOffset}px)`, left: '50%', transform: 'translateX(-15%)' }
      case 'top-left': 
        return { bottom: show ? `calc(100% + ${hoverOffset}px)` : `calc(100% + ${baseOffset}px)`, right: '50%', transform: 'translateX(15%)' }
      default: 
        return { bottom: show ? `calc(100% + ${hoverOffset}px)` : `calc(100% + ${baseOffset}px)`, left: '50%', transform: 'translateX(-50%)' }
    }
  }

  return (
    <div
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}
    >
      {children}
      <div style={{
        position: 'absolute',
        ...getPositionStyles(),
        background: '#475569',
        color: '#f8fafc',
        padding: '0.35rem 0.65rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        zIndex: 9999,
        pointerEvents: 'none',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        opacity: show ? 1 : 0,
        visibility: show ? 'visible' : 'hidden',
        transition: 'all 0.2s ease-out'
      }}>
        {text}
      </div>
    </div>
  )
}
