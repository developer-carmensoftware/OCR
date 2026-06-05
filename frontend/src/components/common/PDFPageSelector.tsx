import { useState } from 'react'
import { FileText, AlertTriangle } from 'lucide-react'

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

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(thumbnails.map((_, i) => i)))
  }

  function deselectAll() {
    setSelected(new Set())
  }

  const sortedSelected = [...selected].sort((a, b) => a - b)
  const overLimit = sortedSelected.length > MAX_PAGES
  // Backend caps at MAX_PAGES; cap here too so what we send matches what we say.
  const effectiveSelection = sortedSelected.slice(0, MAX_PAGES)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--card-bg, #fff)',
          color: 'var(--text, #111827)',
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border, #e5e7eb)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem 0.75rem',
            borderBottom: '1px solid var(--border, #e5e7eb)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FileText size={18} color="var(--primary, #3b82f6)" />
            <strong style={{ fontSize: '0.95rem', color: 'var(--text, #111827)' }}>
              {thumbnails.length} pages detected — select the pages to OCR
            </strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '2px 10px' }}
              onClick={selectAll}
            >
              Select all
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '2px 10px' }}
              onClick={deselectAll}
            >
              Clear all
            </button>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.78rem',
                color: 'var(--text-3, #6b7280)',
              }}
            >
              {sortedSelected.length} / {thumbnails.length} selected
            </span>
          </div>
          {overLimit && (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.75rem',
                color: 'var(--warning, #b45309)',
              }}
            >
              <AlertTriangle size={14} />
              Only the first {MAX_PAGES} selected pages will be processed.
            </div>
          )}
        </div>

        {/* Thumbnail grid */}
        <div
          style={{
            overflowY: 'auto',
            padding: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '0.75rem',
            flex: 1,
          }}
        >
          {thumbnails.map((thumb, i) => (
            <div
              key={i}
              onClick={() => toggle(i)}
              style={{
                cursor: 'pointer',
                borderRadius: 8,
                border: selected.has(i)
                  ? '2px solid var(--primary, #3b82f6)'
                  : '2px solid var(--border, #e5e7eb)',
                overflow: 'hidden',
                position: 'relative',
                background: 'var(--muted, #f9fafb)',
                transition: 'border-color 0.15s',
              }}
            >
              <img
                src={thumb}
                alt={`Page ${i + 1}`}
                style={{ width: '100%', display: 'block', userSelect: 'none' }}
                draggable={false}
              />
              {/* Checkbox overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  border: '2px solid var(--primary, #3b82f6)',
                  background: selected.has(i) ? 'var(--primary, #3b82f6)' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {selected.has(i) && '✓'}
              </div>
              <div
                style={{
                  padding: '4px 0',
                  textAlign: 'center',
                  fontSize: '0.7rem',
                  color: 'var(--text-3, #6b7280)',
                }}
              >
                Page {i + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border, #e5e7eb)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={effectiveSelection.length === 0}
            onClick={() => onConfirm(effectiveSelection)}
          >
            Continue ({effectiveSelection.length}{' '}
            {effectiveSelection.length === 1 ? 'page' : 'pages'})
          </button>
        </div>
      </div>
    </div>
  )
}
