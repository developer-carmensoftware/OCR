import { useState, useEffect, useLayoutEffect, useRef, CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n/LanguageContext'

export interface SelectOption {
  code: string
  name: string
  name2?: string
  /** Listed but not pickable — e.g. a Phase 2 bank the server marks `supported: false`. */
  disabled?: boolean
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

/** Where the list goes for a field at `rect`: under it, or above it when only above fits.
 *  Fixed, because the list is portaled to <body> — so it is re-placed as the page scrolls. */
function panelStyle(rect: DOMRect): CSSProperties {
  const PANEL_H = 240
  const fitsBelow = window.innerHeight - rect.bottom >= PANEL_H
  const fitsAbove = rect.top >= PANEL_H
  const openAbove = !fitsBelow && fitsAbove
  return {
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
  }
}

/** A pickable row of the list — the arrow keys walk these, in order. */
const OPTION = '[role="button"]:not([aria-disabled="true"])'

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
  const inputRef = useRef<HTMLInputElement>(null)
  // Set just before focus is handed back to the field, so that focus does not reopen the
  // list it came from.
  const skipOpenRef = useRef(false)

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

    // Follows its field while the page scrolls — off screen with it, too. It used to close on
    // any scroll, and the app scrolls smoothly: focusing a field that is off screen opens the
    // list and *then* scrolls the field into view, so it closed on the first frame (measured:
    // open at 15 ms, gone at 32). Mid-reveal, that field is off screen exactly like one
    // scrolled away, so there is no screen test to close on either. Click-away and Tab close.
    function handleScroll(event: Event) {
      if (!isOpen || !wrapperRef.current) return
      if (
        dropdownRef.current &&
        (dropdownRef.current === event.target || dropdownRef.current.contains(event.target as Node))
      ) {
        return
      }
      const rect = wrapperRef.current.getBoundingClientRect()
      // A scrolling box around the field (the payment-type dialog's body) clips it: once the
      // field has left that box the list would float over whatever is next to it. The
      // document itself is not such a box — see above.
      const box = event.target instanceof Element ? event.target : null
      if (box && box.contains(wrapperRef.current)) {
        const inner = box.getBoundingClientRect()
        if (rect.bottom < inner.top || rect.top > inner.bottom) {
          setIsOpen(false)
          setSearchTerm(value || '')
          return
        }
      }
      setDropdownStyle(panelStyle(rect))
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
    setDropdownStyle(panelStyle(wrapperRef.current.getBoundingClientRect()))
  }, [isOpen])

  const close = () => {
    setIsOpen(false)
    setSearchTerm(value || '')
  }
  // Back to the field after a keyboard pick or Escape. The option that had focus is about
  // to unmount, and focus left to fall to <body> sends a keyboard user to the top of the page
  // — inside a dialog, out of its reach for Escape.
  const backToField = () => {
    if (document.activeElement === inputRef.current) return
    skipOpenRef.current = true
    inputRef.current?.focus()
  }
  const pick = (code: string) => {
    onChange(code)
    setIsOpen(false)
    backToField()
  }
  const optionEls = () => [...(dropdownRef.current?.querySelectorAll<HTMLElement>(OPTION) ?? [])]

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
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        value={displayValue}
        onFocus={() => {
          if (skipOpenRef.current) {
            skipOpenRef.current = false
            return
          }
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
        //
        // Tab moves on with the list closed: it used to stay open behind, one more with every
        // field tabbed through. ArrowDown opens it, or steps into it — the options sit at the
        // end of <body>, where Tab would only reach them after everything else on the page.
        onKeyDown={e => {
          if (e.key === 'Tab') {
            if (isOpen) close()
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!isOpen) {
              setIsOpen(true)
              setSearchTerm('')
            } else optionEls()[0]?.focus()
          } else if (e.key === 'Escape' && isOpen) {
            e.stopPropagation()
            setIsOpen(false)
          }
        }}
      />
      {isOpen &&
        createPortal(
          // Named so a dialog above can tell "a list is open" from "nothing is open"; the
          // panel is portaled to body, so a DOM-containment check cannot find it.
          <div
            ref={dropdownRef}
            className="css-select-panel"
            style={dropdownStyle}
            // The same stop the field makes, for keys pressed on an option: portaled or not,
            // React events bubble through the component tree, so an Escape here reached the
            // payment-type dialog around the picker and cancelled every edit in it.
            onKeyDown={e => {
              if (e.key === 'Escape' || e.key === 'Tab') {
                e.stopPropagation()
                e.preventDefault()
                close()
                backToField()
                return
              }
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
              e.preventDefault()
              const items = optionEls()
              const at = items.indexOf(document.activeElement as HTMLElement)
              const next = items[e.key === 'ArrowDown' ? at + 1 : at - 1]
              if (next) next.focus()
              else if (e.key === 'ArrowUp') backToField()
            }}
          >
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
                  tabIndex={-1}
                  onMouseDown={e => {
                    e.preventDefault()
                    pick(topChoice.code)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      pick(topChoice.code)
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
                    {t('common.allOptions')}
                  </div>
                )}
              </>
            )}

            {filteredWithoutTop.map(opt => (
              <div
                key={opt.code}
                role="button"
                aria-disabled={opt.disabled || undefined}
                // Reached with the arrow keys, not Tab: see the field's onKeyDown.
                tabIndex={-1}
                style={{
                  padding: '0.6rem 0.8rem',
                  borderBottom: '1px solid var(--gray-100)',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  opacity: opt.disabled ? 0.45 : 1,
                  transition: 'background 0.1s',
                }}
                onMouseDown={e => {
                  e.preventDefault()
                  if (opt.disabled) return
                  pick(opt.code)
                }}
                onKeyDown={e => {
                  if (opt.disabled) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    pick(opt.code)
                  }
                }}
                onMouseEnter={e => {
                  if (opt.disabled) return
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
                {t('common.noResults')}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
