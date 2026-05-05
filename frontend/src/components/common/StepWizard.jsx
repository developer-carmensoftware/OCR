import { Check } from 'lucide-react'

const DEFAULT_STEPS = [
  { n: 1, label: 'Select Bank', sub: '& File' },
  { n: 2, label: 'AI Extract', sub: '' },
  { n: 3, label: 'Review', sub: 'Data' },
  { n: 4, label: 'Accounting', sub: 'Review' },
  { n: 5, label: 'Input Tax', sub: 'Reconciliation' },
]

export default function StepWizard({ step, steps, onStepClick }) {
  const STEPS = steps || DEFAULT_STEPS
  return (
    <div className="step-wizard-wrap">
      <div className="step-wizard">
        {STEPS.map((s, i) => {
          const isDone      = step > s.n
          const isActive    = step === s.n
          const isClickable = isDone && !!onStepClick
          return (
            <div key={s.n} style={{ display: 'contents' }}>
              <div
                className={`step ${isActive ? 'active' : isDone ? 'done' : ''} ${isClickable ? 'clickable' : ''}`}
                onClick={isClickable ? () => onStepClick(s.n) : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                title={isClickable ? `Back to Step ${s.n}: ${s.label}` : undefined}
                onKeyDown={isClickable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStepClick(s.n) }
                } : undefined}
              >
                <div className="step-num">
                  {isDone ? <Check size={11} strokeWidth={3} /> : String(s.n).padStart(2, '0')}
                </div>
                <span className="step-label">
                  {s.label}
                  {s.sub && <span style={{ display: 'inline', opacity: 0.65 }}>{' '}{s.sub}</span>}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="step-sep"
                  style={step > s.n ? { background: 'var(--teal)', opacity: 0.4 } : {}}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
