import { useState, useEffect, useRef, CSSProperties } from 'react'
import { createPortal } from 'react-dom'

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
}

export default function CustomSearchSelect({
  value,
  onChange,
  options,
  placeholder,
  topChoice,
  suggestedValue,
  hasError = false,
}: Props) {
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
    document.addEventListener('touchstart', handleClickOutside)
    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleScroll)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [value, isOpen])

  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: '240px',
        overflowY: 'auto',
        background: 'var(--gray-50)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        zIndex: 99999,
        transformOrigin: 'top center',
        animation: 'fadeDown 180ms var(--ease-out)',
      })
    }
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
          label: 'History',
          bg: 'var(--btn-ok-bg, #f0fdf4)',
          color: 'var(--btn-ok-text, #16a34a)',
          border: 'var(--btn-ok-border, #86efac)',
        }
      : {
          label: 'AI แนะนำ',
          bg: 'var(--ap-suggest-bg, #f5f3ff)',
          color: 'var(--primary, #7c3aed)',
          border: 'var(--primary-mid, #c4b5fd)',
        }

  const selectedOption = value ? options.find(o => o.code === value) : null
  const selectedDesc = selectedOption
    ? [selectedOption.name, selectedOption.name2].filter(Boolean).join(' · ')
    : null

  const isAISuggested = !isOpen && !!suggestedValue
  const displayValue = isOpen ? searchTerm : isAISuggested ? (suggestedValue ?? '') : value || ''

  const suggestedOption = suggestedValue ? options.find(o => o.code === suggestedValue) : null
  const suggestedDesc = suggestedOption
    ? [suggestedOption.name, suggestedOption.name2].filter(Boolean).join(' · ')
    : null

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        placeholder={placeholder}
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
            ? `AI แนะนำ: ${suggestedValue}${suggestedDesc ? ` — ${suggestedDesc}` : ''}`
            : value && selectedDesc
              ? `${value} — ${selectedDesc}`
              : ''
        }
        className="search-select-input"
        style={{
          width: '100%',
          padding: '0.5rem 0.65rem',
          border: `1px solid ${isAISuggested ? 'var(--primary-mid)' : hasError ? 'var(--rose)' : 'var(--border)'}`,
          borderBottomColor: isOpen
            ? 'var(--primary)'
            : isAISuggested
              ? 'var(--primary-mid)'
              : hasError
                ? 'var(--rose)'
                : 'var(--border)',
          borderRadius: '6px',
          fontSize: '0.85rem',
          outline: 'none',
          transition:
            'border-color 180ms var(--ease-out), background-color 180ms var(--ease-out), color 180ms var(--ease-out)',
          fontFamily: "'DM Mono', monospace",
          background: isAISuggested
            ? 'var(--primary-light)'
            : hasError
              ? 'var(--rose-light)'
              : 'transparent',
          color: isAISuggested ? 'var(--primary)' : 'inherit',
        }}
      />
      {isOpen &&
        createPortal(
          <div ref={dropdownRef} style={dropdownStyle}>
            {showTopChoice && topChoice && (
              <>
                <div
                  onMouseDown={e => {
                    e.preventDefault()
                    onChange(topChoice.code)
                    setIsOpen(false)
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.background = topBadge.bg
                  }}
                  style={{
                    padding: '0.6rem 0.8rem',
                    background: topBadge.bg,
                    borderBottom: `1px solid ${topBadge.border}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    transition: 'background 0.1s',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: topBadge.color,
                        fontSize: '0.85rem',
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {topChoice.code}{' '}
                      <span style={{ fontWeight: 500, fontFamily: "'Sarabun', sans-serif" }}>
                        - {topChoice.name}
                      </span>
                    </div>
                    {topChoice.name2 && (
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: topBadge.color,
                          opacity: 0.75,
                          marginTop: '2px',
                          fontFamily: "'Sarabun', sans-serif",
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
                      fontSize: '0.7rem',
                      color: 'var(--text-4)',
                      background: 'var(--gray-50)',
                      borderBottom: '1px solid var(--gray-100)',
                    }}
                  >
                    ตัวเลือกทั้งหมด
                  </div>
                )}
              </>
            )}

            {filteredWithoutTop.map((opt, i) => (
              <div
                key={i}
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
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {opt.code}{' '}
                  <span
                    style={{
                      color: 'var(--text-3)',
                      fontWeight: 500,
                      fontFamily: "'Sarabun', sans-serif",
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
                      fontFamily: "'Sarabun', sans-serif",
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
                ไม่พบข้อมูล
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
