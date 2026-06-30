import { useState, useRef, useEffect } from 'react'
import { Landmark, ChevronDown, RotateCw, CircleCheck, CircleHelp } from 'lucide-react'
import { BANKS, BANK_THAI_NAMES } from '../../constants'
import { useT } from '../../i18n/LanguageContext'
import type { BankCode } from '../../types/api'

const BANK_LOGOS = Object.fromEntries(
  ['BBL', 'KBANK', 'SCB'].map(k => [
    k,
    new URL(`../../assets/bankLogo/${k.toLowerCase()}.svg`, import.meta.url).href,
  ])
)

interface Props {
  bank: BankCode | ''
  loading: boolean
  onReExtract: (bank: BankCode | null) => void
}

export default function BankDetectionBanner({ bank, loading, onReExtract }: Props) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const OPTIONS: Array<{ value: BankCode | null; label: string; sub: string }> = [
    { value: null, label: t('cc.autoDetect'), sub: t('cc.autoDetectSub') },
    ...BANKS.map(b => ({ value: b.value, label: b.label, sub: b.full })),
  ]

  const detected = bank
    ? `${BANK_THAI_NAMES[bank as BankCode] || bank} (${bank})`
    : t('cc.unknownBank')

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function handleSelect(value: BankCode | null) {
    setOpen(false)
    onReExtract(value)
  }

  return (
    <div className={`bank-detection-banner ${!bank ? 'unknown' : ''}`}>
      <div className="bank-detection-info">
        <div className="bank-detection-icon">
          {bank ? (
            <CircleCheck size={15} strokeWidth={2.5} />
          ) : (
            <CircleHelp size={15} strokeWidth={2.5} />
          )}
        </div>
        <span className="bank-detection-label">{t('cc.aiDetected')}</span>
        <span className="bank-detection-value">{detected}</span>
      </div>

      <div ref={containerRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className={`btn btn-sm btn-outline bank-reextract-btn ${open ? 'is-open' : ''}`}
          onClick={() => setOpen(v => !v)}
          disabled={loading}
        >
          <RotateCw size={12} />
          {t('cc.reExtract')}
          <ChevronDown size={12} className="bank-reextract-chevron" />
        </button>

        <div
          className={`bank-reextract-dropdown ${open ? 'is-open' : ''}`}
          {...(!open && { 'aria-hidden': true })}
        >
          <div className="bank-reextract-hint">{t('cc.reExtractWith')}</div>
          {OPTIONS.map((opt, i) => (
            <button
              key={opt.value ?? 'auto'}
              type="button"
              className={`bank-reextract-option ${bank === opt.value ? 'is-current' : ''}`}
              style={{ '--i': i } as React.CSSProperties}
              onClick={() => handleSelect(opt.value)}
              tabIndex={open ? 0 : -1}
            >
              {opt.value && BANK_LOGOS[opt.value] ? (
                <img
                  src={BANK_LOGOS[opt.value]}
                  alt={opt.value}
                  style={{ width: 13, height: 13, objectFit: 'contain' }}
                />
              ) : (
                <Landmark size={13} />
              )}
              <span className="bank-reextract-option-label">
                {opt.label}
                {bank === opt.value && (
                  <span className="bank-reextract-option-tag">{t('cc.current')}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import React from 'react'
