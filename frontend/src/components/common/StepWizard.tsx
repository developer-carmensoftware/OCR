import type React from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface Step {
  n: number
  label: string
  sub?: string
}

interface Props {
  step: number
  steps?: Step[]
  onStepClick?: (n: number) => void
}

const DEFAULT_STEPS: Step[] = [
  { n: 1, label: 'Upload', sub: 'File' },
  { n: 2, label: 'Review', sub: 'Data' },
  { n: 3, label: 'Accounting', sub: 'Review' },
  { n: 4, label: 'Input Tax', sub: 'Reconciliation' },
]

export default function StepWizard({ step, steps, onStepClick }: Props) {
  const STEPS = steps || DEFAULT_STEPS
  return (
    <div className="step-wizard-wrap">
      <div className="step-wizard">
        {STEPS.map((s, i) => {
          const isDone = step > s.n
          const isActive = step === s.n
          const isClickable = isDone && !!onStepClick
          const interactiveProps: React.HTMLAttributes<HTMLDivElement> & { tabIndex?: number } =
            isClickable
              ? {
                  role: 'button',
                  tabIndex: 0,
                  title: `Back to Step ${s.n}: ${s.label}`,
                  onClick: () => onStepClick!(s.n),
                  onKeyDown: e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onStepClick!(s.n)
                    }
                  },
                }
              : {}
          return (
            <div key={s.n} style={{ display: 'contents' }}>
              <div
                className={`step ${isActive ? 'active' : isDone ? 'done' : ''} ${isClickable ? 'clickable' : ''}`}
                style={{ position: 'relative' }}
                {...interactiveProps}
              >
                {isActive && (
                  <motion.span
                    layoutId="step-active-pill"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '100px',
                      background: 'var(--primary)',
                      zIndex: 0,
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <div className="step-num" style={{ position: 'relative', zIndex: 1 }}>
                  {isDone ? <Check size={11} strokeWidth={3} /> : String(s.n).padStart(2, '0')}
                </div>
                <span className="step-label" style={{ position: 'relative', zIndex: 1 }}>
                  {s.label}
                  {s.sub && <span style={{ display: 'inline', opacity: 0.65 }}> {s.sub}</span>}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="step-sep"
                  style={step > s.n ? { background: 'var(--emerald)', opacity: 0.6 } : {}}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
