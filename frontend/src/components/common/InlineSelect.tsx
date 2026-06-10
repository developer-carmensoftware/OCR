import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export type InlineSelectAccent = 'amber' | 'blue' | 'green' | 'muted'

export interface InlineSelectOption {
  value: string
  label: string
  description?: string
  accent?: InlineSelectAccent
  warning?: boolean
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: InlineSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  warning?: boolean
  'aria-label'?: string
}

export default function InlineSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  warning,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [placement, setPlacement] = useState<'below' | 'above'>('below')
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value) ?? null

  const close = useCallback(() => {
    setOpen(false)
    setActiveIdx(-1)
  }, [])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const PANEL_H = Math.min(options.length * 40 + 8, 240)
    const fitsBelow = window.innerHeight - rect.bottom >= PANEL_H
    const fitsAbove = rect.top >= PANEL_H

    const dir = fitsBelow || !fitsAbove ? 'below' : 'above'
    setPlacement(dir)
    setPanelStyle({
      position: 'fixed',
      left: rect.left,
      width: 'max-content',
      ...(dir === 'below'
        ? { top: rect.bottom + 4 }
        : { bottom: window.innerHeight - rect.top + 4 }),
    })
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      )
        close()
    }
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(options.findIndex(o => o.value === value))
        setOpen(true)
      }
      return
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        triggerRef.current?.focus()
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        if (activeIdx >= 0) {
          e.preventDefault()
          onChange(options[activeIdx].value)
          close()
          triggerRef.current?.focus()
        }
        break
    }
  }

  const pick = (opt: InlineSelectOption) => {
    onChange(opt.value)
    close()
    triggerRef.current?.focus()
  }

  return (
    <div className={`isel-wrap${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="isel-trigger"
        data-accent={selected?.accent}
        data-open={open}
        data-warning={warning || selected?.warning || undefined}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close()
          } else {
            setActiveIdx(options.findIndex(o => o.value === value))
            setOpen(true)
          }
        }}
        onKeyDown={handleKeyDown}
      >
        {selected?.accent && (
          <span className="isel-dot" data-accent={selected.accent} aria-hidden="true" />
        )}
        <span className="isel-label">{selected?.label ?? placeholder ?? '—'}</span>
        <ChevronDown size={11} className="isel-chevron" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="isel-panel"
            style={panelStyle}
            data-placement={placement}
            role="listbox"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
          >
            {options.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                className="isel-option"
                data-accent={opt.accent}
                data-active={i === activeIdx}
                data-selected={opt.value === value}
                aria-selected={opt.value === value}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={e => {
                  e.preventDefault()
                  pick(opt)
                }}
              >
                {opt.accent && (
                  <span className="isel-opt-dot" data-accent={opt.accent} aria-hidden="true" />
                )}
                <span className="isel-opt-body">
                  <span className="isel-opt-label">{opt.label}</span>
                  {opt.description && <span className="isel-opt-desc">{opt.description}</span>}
                </span>
                {opt.value === value && (
                  <Check size={11} className="isel-opt-check" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
