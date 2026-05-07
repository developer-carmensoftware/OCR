import { useState } from 'react'

const ARROW_SIZE = 5

const POSITIONS = {
  top:          { tooltip: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: ARROW_SIZE + 6 }, arrow: { top: '100%', left: '50%', transform: 'translateX(-50%)', borderColor: 'rgba(15,10,40,0.92) transparent transparent transparent' } },
  bottom:       { tooltip: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: ARROW_SIZE + 6 },    arrow: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', borderColor: 'transparent transparent rgba(15,10,40,0.92) transparent' } },
  left:         { tooltip: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: ARROW_SIZE + 6 }, arrow: { left: '100%', top: '50%', transform: 'translateY(-50%)', borderColor: 'transparent transparent transparent rgba(15,10,40,0.92)' } },
  right:        { tooltip: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: ARROW_SIZE + 6 },  arrow: { right: '100%', top: '50%', transform: 'translateY(-50%)', borderColor: 'transparent rgba(15,10,40,0.92) transparent transparent' } },
  'top-left':   { tooltip: { bottom: '100%', right: 0, marginBottom: ARROW_SIZE + 6 },                               arrow: { top: '100%', right: 10, borderColor: 'rgba(15,10,40,0.92) transparent transparent transparent' } },
  'top-right':  { tooltip: { bottom: '100%', left: 0, marginBottom: ARROW_SIZE + 6 },                                arrow: { top: '100%', left: 10, borderColor: 'rgba(15,10,40,0.92) transparent transparent transparent' } },
  'bottom-left':{ tooltip: { top: '100%', right: 0, marginTop: ARROW_SIZE + 6 },                                     arrow: { bottom: '100%', right: 10, borderColor: 'transparent transparent rgba(15,10,40,0.92) transparent' } },
  'bottom-right':{ tooltip: { top: '100%', left: 0, marginTop: ARROW_SIZE + 6 },                                    arrow: { bottom: '100%', left: 10, borderColor: 'transparent transparent rgba(15,10,40,0.92) transparent' } },
}

export default function Tooltip({ text, children, position = 'top' }) {
  const [visible, setVisible] = useState(false)
  const pos = POSITIONS[position] ?? POSITIONS.top

  return (
    <div
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}
    >
      {children}

      {/* Tooltip bubble */}
      <div style={{
        position: 'absolute',
        ...pos.tooltip,
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
        zIndex: 9999,
        pointerEvents: 'none',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
        opacity: visible ? 1 : 0,
        transform: `${pos.tooltip.transform ?? ''} scale(${visible ? 1 : 0.94})`,
        transformOrigin: ORIGIN[position] ?? 'bottom center',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
        visibility: visible ? 'visible' : 'hidden',
      }}>
        {text}

        {/* Arrow */}
        <div style={{
          position: 'absolute',
          ...pos.arrow,
          width: 0, height: 0,
          borderStyle: 'solid',
          borderWidth: ARROW_SIZE,
          borderColor: pos.arrow.borderColor,
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}

const ORIGIN = {
  top: 'bottom center',
  bottom: 'top center',
  left: 'center right',
  right: 'center left',
  'top-left': 'bottom right',
  'top-right': 'bottom left',
  'bottom-left': 'top right',
  'bottom-right': 'top left',
}
