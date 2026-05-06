import { useState, useRef, useEffect } from 'react'
import { Landmark, ChevronDown, RotateCw, CircleCheck, CircleHelp } from 'lucide-react'
import { BANKS, BANK_THAI_NAMES } from '../../constants'

const BANK_LOGOS = Object.fromEntries(
  ['BBL', 'KBANK', 'SCB'].map(k => [
    k,
    new URL(`../../assets/bankLogo/${k.toLowerCase()}.svg`, import.meta.url).href,
  ])
)

const OPTIONS = [
  { value: null,    label: 'Auto-detect',         sub: 'Let AI identify the bank' },
  ...BANKS.map(b => ({ value: b.value, label: b.label, sub: b.full })),
]

export default function BankDetectionBanner({ bank, loading, onReExtract }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const detected = bank ? `${BANK_THAI_NAMES[bank] || bank} (${bank})` : 'Unknown bank'

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function handleSelect(value) {
    setOpen(false)
    onReExtract(value)
  }

  return (
    <div className={`bank-detection-banner ${!bank ? 'unknown' : ''}`}>
      <div className="bank-detection-info">
        <div className="bank-detection-icon">
          {bank
            ? <CircleCheck size={15} strokeWidth={2.5} />
            : <CircleHelp size={15} strokeWidth={2.5} />}
        </div>
        <span className="bank-detection-label">AI detected</span>
        <span className="bank-detection-value">{detected}</span>
      </div>

      <div ref={containerRef} style={{ position: 'relative' }}>
        <button
          className={`btn btn-sm btn-outline bank-reextract-btn ${open ? 'is-open' : ''}`}
          onClick={() => setOpen(v => !v)}
          disabled={loading}
        >
          <RotateCw size={12} />
          Re-extract
          <ChevronDown size={12} className="bank-reextract-chevron" />
        </button>

        {/* Always in DOM — CSS transitions handle open/close */}
        <div className={`bank-reextract-dropdown ${open ? 'is-open' : ''}`} aria-hidden={!open}>
          <div className="bank-reextract-hint">Re-extract with:</div>
          {OPTIONS.map((opt, i) => (
            <button
              key={opt.value ?? 'auto'}
              className={`bank-reextract-option ${bank === opt.value ? 'is-current' : ''}`}
              style={{ '--i': i }}
              onClick={() => handleSelect(opt.value)}
              tabIndex={open ? 0 : -1}
            >
              {BANK_LOGOS[opt.value]
                ? <img src={BANK_LOGOS[opt.value]} alt={opt.value} style={{ width: 13, height: 13, objectFit: 'contain' }} />
                : <Landmark size={13} />}
              <span className="bank-reextract-option-label">
                {opt.label}
                {bank === opt.value && (
                  <span className="bank-reextract-option-tag">current</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
