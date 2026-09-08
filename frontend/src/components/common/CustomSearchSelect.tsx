import { useState, useEffect, useLayoutEffect, useRef, CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../i18n/LanguageContext'

export interface SelectOption {
  code: string
  name: string
  name2?: string
}

export interface TopChoice extends SelectOption {
  source?: string | null
}

interface Props {
  value: string | null
  onChange: (code: string) => void
  options: SelectOption[]
  placeholder?: string
  topChoice?: TopChoice | null
  suggestedValue?: string | null
  hasError?: boolean
  /** Short note pinned above the option list (e.g. why the list is filtered) */
  notice?: string
  'aria-label'?: string
}

export default function CustomSearchSelect({
  value,
  onChange,
  options,
  placeholder,
  topChoice,
  suggestedValue,
  hasError = false,
  notice,
  'aria-label': ariaLabel,
}: Props) {
  const { t } = useT()
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSearchTerm(value || '')
  }, [value])

  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target as Node))
      ) {
        setIsOpen(false)
        setSearchTerm(value || '')
      }
    }

    function handleScroll(event: Event) {
      if (isOpen) {
        if (
          dropdownRef.current &&
          (dropdownRef.current === event.target ||
            dropdownRef.current.contains(event.target as Node))
        ) {
          return
        }
        setIsOpen(false)
        setSearchTerm(value || '')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    if (isOpen) {
      window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
      window.addEventListener('resize', handleScroll)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, { capture: true })
      window.removeEventListener('resize', handleScroll)
    }
  }, [value, isOpen])

  useLayoutEffect(() => {
    if (!isOpen || !wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const PANEL_H = 240
    const fitsBelow = window.innerHeight - rect.bottom >= PANEL_H
    const fitsAbove = rect.top >= PANEL_H
    const openAbove = !fitsBelow && fitsAbove
    setDropdownStyle({
      position: 'fixed',
      ...(openAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      left: rect.left,
      width: rect.width,
      maxHeight: '240px',
      overflowY: 'auto',
      background: 'var(--gray-50)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      zIndex: 10300,
      transformOrigin: openAbove ? 'bottom center' : 'top center',
      animation: 'fadeDown 180ms var(--ease-out)',
    })
  }, [isOpen])

  const q = searchTerm.toLowerCase()
  const filtered = options.filter(
    o =>
      (o.code && o.code.toLowerCase().includes(q)) ||
      (o.name && o.name.toLowerCase().includes(q)) ||
      (o.name2 && o.name2.toLowerCase().includes(q))
  )

  const showTopChoice =
    topChoice &&
    topChoice.code !== value &&
    (!q ||
      topChoice.code.toLowerCase().includes(q) ||
      (topChoice.name && topChoice.name.toLowerCase().includes(q)))

  const filteredWithoutTop = showTopChoice
    ? filtered.filter(o => o.code !== topChoice.code)
    : filtered

  const topBadge =
    topChoice?.source === 'history'
      ? {
          label: t('common.history'),
          bg: 'var(--btn-ok-bg, #f0fdf4)',
          color: 'var(--btn-ok-text, #16a34a)',
          border: 'var(--btn-ok-border, #86efac)',
        }
      : {
          label: t('common.aiSuggested'),
          bg: 'var(--ap-suggest-bg, #f5f3ff)',
          color: 'var(--primary, #7c3aed)',
          border: 'var(--primary-mid, #c4b5fd)',
        }

  const selectedOption = value ? options.find(o => o.code === value) : null
  const selectedDesc = selectedOption
    ? [selectedOption.name, selectedOption.name2].filter(Boolean).join(' · ')
    : null

  const isAISuggested = !isOpen && !!suggestedValue && !value
  const displayValue = isOpen ? searchTerm : isAISuggested ? (suggestedValue ?? '') : value || ''

  const suggestedOption = suggestedValue ? options.find(o => o.code === suggestedValue) : null
  const suggestedDesc = suggestedOption
    ? [suggestedOption.name, suggestedOption.name2].filter(Boolean).join(' · ')
    : null

  return (
    <div ref={wrapperRef} className="custom-search-select">
      <input
        type="text"
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        value={displayValue}
        onFocus={() => {
          setIsOpen(true)
          setSearchTerm('')
        }}
        onClick={() => {
          setIsOpen(true)
          setSearchTerm('')
        }}
        onChange={e => setSearchTerm(e.target.value)}
        title={
          isAISuggested
            ? `${t('common.aiSuggested')}: ${suggestedValue}${suggestedDesc ? ` — ${suggestedDesc}` : ''}`
            : value && selectedDesc
              ? `${value} — ${selectedDesc}`
              : ''
        }
        className="search-select-input custom-search-select-input"
        /* State as data attributes, not inline style. It was inline, which meant no
           stylesheet could reach it: the review screen sets every other field flat until
           hover or focus and this one kept a permanent box, with no way to match it short
           of `!important`. The rendered look is unchanged — see components.css. */
        data-open={isOpen || undefined}
        data-suggested={isAISuggested || undefined}
        data-error={hasError || undefined}
        // Escape closes the list, and stops there. Without this the key reaches whatever
        // is behind — inside the review modal that closed the whole dialog and threw away
        // the reviewer's edits, because a dropdown that ignores Escape is indistinguishable
        // from no dropdown being open.
        onKeyDown={e => {
          if (e.key !== 'Escape' || !isOpen) return
          e.stopPropagation()
          setIsOpen(false)
        }}
      />
      {isOpen &&
        createPortal(
          // Named so a dialog above can tell "a list is open" from "nothing is open"; the
          // panel is portaled to body, so a DOM-containment check cannot find it.
          <div ref={dropdownRef} className="css-select-panel" style={dropdownStyle}>
            {notice && (
              <div
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.72rem',
                  color: 'var(--text-3)',
                  background: 'var(--primary-light)',
                  borderBottom: '1px solid var(--gray-100)',
                  position: 'sticky',
                  top: 0,
                }}
              >
                {notice}
              </div>
            )}
            {showTopChoice && topChoice && (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onMouseDown={e => {
                    e.preventDefault()
                    onChange(topChoice.code)
                    setIsOpen(false)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onChange(topChoice.code)
                      setIsOpen(false)
                    }
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.background = topBadge.bg
                  }}
                  className="custom-search-select-top"
                  style={{
                    background: topBadge.bg,
                    borderBottom: `1px solid ${topBadge.border}`,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: topBadge.color,
                        fontSize: '0.85rem',
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {topChoice.code}{' '}
                      <span
                        style={{ fontWeight: 500, fontFamily: "'IBM Plex Sans Thai', sans-serif" }}
                      >
                        - {topChoice.name}
                      </span>
                    </div>
                    {topChoice.name2 && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: topBadge.color,
                          opacity: 0.75,
                          marginTop: '2px',
                          fontFamily: "'IBM Plex Sans Thai', sans-serif",
                        }}
                      >
                        {topChoice.name2}
                      </div>
                    )}
                  </div>
                </div>
                {filteredWithoutTop.length > 0 && (
                  <div
                    style={{
                      padding: '0.2rem 0.8rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-4)',
                      background: 'var(--gray-50)',
                      borderBottom: '1px solid var(--gray-100)',
                    }}
                  >
                    All Options
                  </div>
                )}
              </>
            )}

            {filteredWithoutTop.map(opt => (
              <div
                key={opt.code}
                role="button"
                tabIndex={0}
                style={{
                  padding: '0.6rem 0.8rem',
                  borderBottom: '1px solid var(--gray-100)',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseDown={e => {
                  e.preventDefault()
                  onChange(opt.code)
                  setIsOpen(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onChange(opt.code)
                    setIsOpen(false)
                  }
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: 'var(--primary)',
                    fontSize: '0.85rem',
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {opt.code}{' '}
                  <span
                    style={{
                      color: 'var(--text-3)',
                      fontWeight: 500,
                      fontFamily: "'IBM Plex Sans Thai', sans-serif",
                    }}
                  >
                    {' '}
                    - {opt.name}
                  </span>
                </div>
                {opt.name2 && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-4)',
                      marginTop: '3px',
                      fontFamily: "'IBM Plex Sans Thai', sans-serif",
                    }}
                  >
                    {opt.name2}
                  </div>
                )}
              </div>
            ))}
            {!showTopChoice && filtered.length === 0 && (
              <div
                style={{
                  padding: '0.8rem',
                  color: 'var(--text-4)',
                  fontSize: '0.8rem',
                  textAlign: 'center',
                }}
              >
                No results found
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
