import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { m } from 'framer-motion'
import { FileText, AlertTriangle, Check } from 'lucide-react'

interface Props {
  thumbnails: string[]
  onConfirm: (selectedPages: number[]) => void
  onCancel: () => void
}

// Mirror of backend MAX_PAGES_PER_CALL — the LLM call only accepts this many pages.
const MAX_PAGES = 10

export default function PDFPageSelector({ thumbnails, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(thumbnails.map((_, i) => i).slice(0, MAX_PAGES))
  )
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function selectFirst() {
    setSelected(new Set(thumbnails.map((_, i) => i).slice(0, MAX_PAGES)))
  }

  function deselectAll() {
    setSelected(new Set())
  }

  const sortedSelected = [...selected].sort((a, b) => a - b)
  const overLimit = sortedSelected.length > MAX_PAGES
  const effectiveSet = new Set(sortedSelected.slice(0, MAX_PAGES))
  const effectiveSelection = [...effectiveSet].sort((a, b) => a - b)

  return createPortal(
    <m.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-selector-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="pdf-selector-overlay"
      onClick={onCancel}
    >
      <m.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="pdf-selector-dialog"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <FileText size={16} color="var(--primary)" />
            <span
              id="pdf-selector-title"
              style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}
            >
              Select pages to process
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.78rem',
                color: 'var(--text-3)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {overLimit
                ? `${MAX_PAGES} of ${thumbnails.length}`
                : `${sortedSelected.length} / ${thumbnails.length}`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '3px 10px', height: 'auto', lineHeight: 1.5 }}
              onClick={selectFirst}
            >
              Select first {Math.min(thumbnails.length, MAX_PAGES)}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '3px 10px', height: 'auto', lineHeight: 1.5 }}
              onClick={deselectAll}
            >
              Clear all
            </button>
            {thumbnails.length > MAX_PAGES && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>
                Max {MAX_PAGES} pages per scan
              </span>
            )}
          </div>

          {overLimit && (
            <div className="pdf-selector-alert">
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {sortedSelected.length - MAX_PAGES} page
                {sortedSelected.length - MAX_PAGES !== 1 ? 's' : ''} will be skipped — only the
                first {MAX_PAGES} selected pages will be processed.
              </span>
            </div>
          )}
        </div>

        {/* Thumbnail grid */}
        <section
          aria-label="PDF pages"
          style={{
            overflowY: 'auto',
            padding: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '0.75rem',
            flex: 1,
          }}
        >
          {thumbnails.map((thumb, i) => {
            const isSelected = selected.has(i)
            const isEffective = effectiveSet.has(i)
            const isOverflow = isSelected && !isEffective
            const isHovered = hoveredIdx === i

            const borderColor = isEffective
              ? 'var(--primary)'
              : isOverflow
                ? 'var(--amber)'
                : isHovered
                  ? 'var(--border-hi)'
                  : 'var(--border)'

            return (
              <button
                key={thumb}
                type="button"
                aria-pressed={isSelected}
                aria-label={`Page ${i + 1}${isOverflow ? ' (will be skipped)' : ''}`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => toggle(i)}
                className="pdf-selector-thumbnail-btn"
                style={{
                  borderColor,
                  boxShadow: isHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                }}
              >
                {/* Image container */}
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1.414',
                    width: '100%',
                    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    overflow: 'hidden',
                    background: 'oklch(0.96 0 0)',
                  }}
                >
                  <img
                    src={thumb}
                    alt={`Page ${i + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      userSelect: 'none',
                    }}
                    draggable={false}
                  />

                  {/* Overflow tint */}
                  {isOverflow && (
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'oklch(0.78 0.15 75 / 0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--amber-text)',
                          background: 'var(--amber-light)',
                          border: '1px solid var(--amber-mid)',
                          borderRadius: 4,
                          padding: '2px 6px',
                        }}
                      >
                        Skipped
                      </span>
                    </div>
                  )}

                  {/* Checkbox badge */}
                  <div
                    aria-hidden="true"
                    className="pdf-selector-checkbox"
                    style={{
                      border: `2px solid ${isEffective ? 'var(--primary)' : isOverflow ? 'var(--amber)' : 'var(--border-hi)'}`,
                      background: isEffective
                        ? 'var(--primary)'
                        : isOverflow
                          ? 'var(--amber-mid)'
                          : 'var(--card-bg)',
                      boxShadow: isEffective
                        ? '0 1px 4px oklch(0.4714 0.1794 258.7 / 0.35)'
                        : 'var(--shadow-xs)',
                    }}
                  >
                    {isEffective && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>

                {/* Page label */}
                <div
                  style={{
                    width: '100%',
                    padding: '4px 0 3px',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 500 : 400,
                    color: isEffective
                      ? 'var(--primary)'
                      : isOverflow
                        ? 'var(--amber-text)'
                        : 'var(--text-3)',
                    transition: 'color var(--dur-fast) var(--ease)',
                  }}
                >
                  Page {i + 1}
                </div>
              </button>
            )
          })}
        </section>

        {/* Footer */}
        <div className="pdf-selector-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={effectiveSelection.length === 0}
            onClick={() => onConfirm(effectiveSelection)}
          >
            Continue
            <span style={{ opacity: 0.75, marginLeft: 4 }}>
              ({effectiveSelection.length} {effectiveSelection.length === 1 ? 'page' : 'pages'})
            </span>
          </button>
        </div>
      </m.div>
    </m.div>,
    document.body
  )
}
