import { useState, useRef, useEffect } from 'react'
import { ChevronDown, CircleDot, PlusCircle, Ban } from 'lucide-react'

export type TaxTypeValue = 'Include' | 'Exclude' | 'None'

interface Option {
  value: TaxTypeValue
  label: string
  sublabel: string
  icon: React.ReactNode
  colorVar: string
  bgVar: string
  borderVar: string
}

const OPTIONS: Option[] = [
  {
    value: 'Include',
    label: 'Tax Include',
    sublabel: 'VAT รวมในราคา',
    icon: <CircleDot size={14} />,
    colorVar: 'var(--amber-700, #b45309)',
    bgVar: 'var(--ap-include-bg, #fffbeb)',
    borderVar: 'var(--amber-300, #fcd34d)',
  },
  {
    value: 'Exclude',
    label: 'Tax Exclude',
    sublabel: 'VAT บวกเพิ่มจากราคา',
    icon: <PlusCircle size={14} />,
    colorVar: 'var(--blue-700, #1d4ed8)',
    bgVar: 'var(--ap-exclude-bg, #eff6ff)',
    borderVar: 'var(--blue-300, #93c5fd)',
  },
  {
    value: 'None',
    label: 'No VAT',
    sublabel: 'ไม่มีภาษีมูลค่าเพิ่ม (0%)',
    icon: <Ban size={14} />,
    colorVar: 'var(--emerald, #059669)',
    bgVar: 'var(--ap-none-bg, #f0fdf4)',
    borderVar: 'var(--emerald-300, #6ee7b7)',
  },
]

interface Props {
  value: TaxTypeValue | string
  onChange: (v: TaxTypeValue) => void
}

export default function TaxTypeDropdown({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const selected = OPTIONS.find(o => o.value === value) ?? OPTIONS[1]

  const handleSelect = (v: TaxTypeValue) => {
    setOpen(false)
    if (v !== value) onChange(v)
  }

  return (
    <div className="ttd-root" ref={ref}>
      <span className="ttd-label">Tax type :</span>

      {/* Trigger */}
      <button
        type="button"
        className="ttd-trigger"
        data-value={selected.value}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
      >
        <span className="ttd-trigger-icon">{selected.icon}</span>
        <span className="ttd-trigger-text">{selected.label}</span>
        <ChevronDown size={13} className={`ttd-chevron${open ? ' ttd-chevron--open' : ''}`} />
      </button>

      {/* Dropdown panel */}
      <div className="ttd-panel" data-open={open} role="listbox" aria-label="Tax type">
        {OPTIONS.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            role="option"
            className="ttd-option"
            data-index={i}
            data-value={opt.value}
            data-active={opt.value === value}
            onClick={() => handleSelect(opt.value)}
          >
            <span className="ttd-option-dot" />
            <span className="ttd-option-badge" data-value={opt.value}>
              {opt.icon}
              {opt.label}
            </span>
            <span className="ttd-option-sub">{opt.sublabel}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
