import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'
import {
  CreditCard,
  ReceiptText,
  Lightbulb,
  FileText,
  Settings2,
  FileCheck2,
  Receipt,
  ScanLine,
  ShieldCheck,
  Database,
  Tag,
  Sparkles,
  Hash,
  ArrowRight,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'

/* ── Shared helpers ── */

function useInViewSequence(timeline: readonly number[], active: boolean) {
  const ref = useRef<HTMLElement>(null)
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (!active) {
      setPhase(0)
      return
    }
    const el = ref.current
    if (!el) return
    const final = timeline.length + 1
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setPhase(final)
      return
    }
    const timers: number[] = []
    setPhase(1)
    timeline.forEach((t, i) => timers.push(window.setTimeout(() => setPhase(i + 2), t)))
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [timeline, active])
  return { ref, phase }
}

function Head({ Icon, title, sub }: { Icon: LucideIcon; title: string; sub: string }) {
  return (
    <header className="flow-head">
      <span className="flow-head-icon" aria-hidden="true">
        <Icon size={24} strokeWidth={1.9} />
      </span>
      <div className="flow-head-text">
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
    </header>
  )
}

function Node({
  Icon,
  label,
  caption,
  on,
  spin,
}: {
  Icon: LucideIcon
  label: string
  caption: string
  on: boolean
  spin?: boolean
}) {
  return (
    <div className={`flow-node${on ? ' is-on' : ''}`}>
      <span className={`flow-node-icon${spin ? ' flow-node-icon--spin' : ''}`} aria-hidden="true">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="flow-node-label">{label}</span>
      <span className="flow-node-caption">{caption}</span>
    </div>
  )
}

function HArrow({ on }: { on: boolean }) {
  return (
    <span className={`flow-arrow${on ? ' is-on' : ''}`} aria-hidden="true">
      <ArrowRight size={20} />
    </span>
  )
}

/* ── Feature definitions ── */

const FEATURES = [
  {
    key: 'cc',
    Icon: CreditCard,
    title: 'Credit Card Commission Automation',
    accent: 'accent-blue',
    descKey: 'flows.cc.desc',
  },
  {
    key: 'ap',
    Icon: ReceiptText,
    title: 'AP Invoice Automation',
    accent: 'accent-emerald',
    descKey: 'flows.ap.desc',
  },
  {
    key: 'gl',
    Icon: Lightbulb,
    title: 'Account Code Suggestion',
    accent: 'accent-teal',
    descKey: 'flows.gl.desc',
  },
] as const satisfies ReadonlyArray<{
  key: string
  Icon: LucideIcon
  title: string
  accent: string
  descKey: TKey
}>

/* ── Flow detail panels ── */

const CC_TIMELINE = [850, 2050] as const

function CreditCardDetail({ active }: { active: boolean }) {
  const { t } = useT()
  const { ref, phase } = useInViewSequence(CC_TIMELINE, active)
  return (
    <article ref={ref} className="flow-card accent-blue">
      <Head Icon={CreditCard} title="Credit Card Commission Automation" sub={t('flows.cc.sub')} />
      <div className="flow-body flow-row">
        <Node
          Icon={FileText}
          label={t('flows.cc.n1.label')}
          caption={t('flows.cc.n1.cap')}
          on={phase >= 1}
        />
        <HArrow on={phase >= 2} />
        <div className={`flow-node flow-node--wide${phase >= 2 ? ' is-on' : ''}`}>
          <span
            className={`flow-node-icon${phase >= 2 ? ' flow-node-icon--spin' : ''}`}
            aria-hidden="true"
          >
            <Settings2 size={22} strokeWidth={1.8} />
          </span>
          <span className="flow-node-label">{t('flows.cc.match.label')}</span>
          <ul className="flow-checklist">
            <li>{t('flows.cc.chk1')}</li>
            <li>{t('flows.cc.chk2')}</li>
            <li>{t('flows.cc.chk3')}</li>
          </ul>
        </div>
        <span className={`flow-branch${phase >= 3 ? ' is-on' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 100 100" fill="none" preserveAspectRatio="none">
            <path
              d="M 0 50 C 35 50, 45 18, 100 18"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 0 50 C 35 50, 45 82, 100 82"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </span>
        <div className="flow-out-col">
          <div className={`flow-out${phase >= 3 ? ' is-on' : ''}`}>
            <span className="flow-out-tag" aria-hidden="true">
              <FileCheck2 size={18} />
            </span>
            <div>
              <h4>{t('flows.cc.out1.h')}</h4>
              <p>{t('flows.cc.out1.p')}</p>
            </div>
          </div>
          <div className={`flow-out${phase >= 3 ? ' is-on' : ''}`}>
            <span className="flow-out-tag" aria-hidden="true">
              <Receipt size={18} />
            </span>
            <div>
              <h4>{t('flows.cc.out2.h')}</h4>
              <p>{t('flows.cc.out2.p')}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flow-result">
        <span className="flow-result-mark" aria-hidden="true">
          ✓
        </span>
        <p>{t('flows.cc.result')}</p>
      </div>
    </article>
  )
}

const AP_TIMELINE = [800, 1750, 2700, 3650, 4600] as const

function ApInvoiceDetail({ active }: { active: boolean }) {
  const { t } = useT()
  const { ref, phase } = useInViewSequence(AP_TIMELINE, active)
  return (
    <article ref={ref} className="flow-card accent-emerald">
      <Head Icon={ReceiptText} title="AP Invoice Automation" sub={t('flows.ap.sub')} />
      <div className="flow-body flow-stepper">
        <div className={`flow-stage${phase >= 1 ? ' is-on' : ''}`}>
          <span className="flow-stage-no">1</span>
          <Node
            Icon={ScanLine}
            label={t('flows.ap.s1.label')}
            caption={t('flows.ap.s1.cap')}
            on={phase >= 1}
          />
        </div>
        <span className={`flow-down${phase >= 2 ? ' is-on' : ''}`} aria-hidden="true">
          <ArrowRight size={18} />
        </span>
        <div className={`flow-stage${phase >= 2 ? ' is-on' : ''}`}>
          <span className="flow-stage-no">2</span>
          <div className="flow-substages">
            <Node
              Icon={FileText}
              label={t('flows.ap.s2a.label')}
              caption={t('flows.ap.s2a.cap')}
              on={phase >= 2}
            />
            <HArrow on={phase >= 3} />
            <Node
              Icon={ShieldCheck}
              label={t('flows.ap.s2b.label')}
              caption={t('flows.ap.s2b.cap')}
              on={phase >= 3}
            />
            <HArrow on={phase >= 4} />
            <Node
              Icon={Database}
              label={t('flows.ap.s2c.label')}
              caption={t('flows.ap.s2c.cap')}
              on={phase >= 4}
            />
          </div>
        </div>
        <span className={`flow-down${phase >= 5 ? ' is-on' : ''}`} aria-hidden="true">
          <ArrowRight size={18} />
        </span>
        <div className={`flow-stage${phase >= 5 ? ' is-on' : ''}`}>
          <span className="flow-stage-no">3</span>
          <div className="flow-out-list">
            <h4>{t('flows.ap.out.h')}</h4>
            <ul>
              <li>{t('flows.ap.out1')}</li>
              <li>{t('flows.ap.out2')}</li>
              <li>{t('flows.ap.out3')}</li>
            </ul>
          </div>
        </div>
      </div>
      <div className={`flow-benefits${phase >= 6 ? ' is-on' : ''}`}>
        <div className="flow-benefit">
          <b>60%</b>
          <span>{t('flows.ap.b1.label')}</span>
        </div>
        <div className="flow-benefit">
          <span>{t('flows.ap.b2.label')}</span>
          <small>{t('flows.ap.b2.sub')}</small>
        </div>
        <div className="flow-benefit">
          <span>{t('flows.ap.b3.label')}</span>
          <small>{t('flows.ap.b3.sub')}</small>
        </div>
      </div>
    </article>
  )
}

const GL_TIMELINE = [850, 2050] as const

const GL_SAMPLES = [
  {
    key: 'water',
    labelKey: 'flows.gl.s.water',
    codeKey: 'flows.gl.s.water.code',
    confidence: '98%',
  },
  {
    key: 'laundry',
    labelKey: 'flows.gl.s.laundry',
    codeKey: 'flows.gl.s.laundry.code',
    confidence: '95%',
  },
  {
    key: 'salmon',
    labelKey: 'flows.gl.s.salmon',
    codeKey: 'flows.gl.s.salmon.code',
    confidence: '92%',
  },
] as const satisfies ReadonlyArray<{
  key: string
  labelKey: TKey
  codeKey: TKey
  confidence: string
}>

function GlSuggestionDetail({ active }: { active: boolean }) {
  const { t } = useT()
  const { ref, phase } = useInViewSequence(GL_TIMELINE, active)
  const [selected, setSelected] = useState(0)
  const sample = GL_SAMPLES[selected]
  const done = phase >= 3
  return (
    <article ref={ref} className="flow-card accent-teal">
      <Head Icon={Lightbulb} title="Account Code Suggestion" sub={t('flows.gl.sub')} />
      <div className="flow-body flow-row">
        <div className={`flow-node flow-node--wide${phase >= 1 ? ' is-on' : ''}`}>
          <span className="flow-node-label">{t('flows.gl.pick')}</span>
          <div className="gl-pills">
            {GL_SAMPLES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className={`gl-pill${selected === i ? ' is-selected' : ''}`}
                onClick={() => setSelected(i)}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>
        <HArrow on={phase >= 2} />
        <Node
          Icon={Sparkles}
          label={t('flows.gl.compare.label')}
          caption={phase >= 2 ? t('flows.gl.compare.capOn') : t('flows.gl.compare.capOff')}
          on={phase >= 2}
        />
        <HArrow on={done} />
        <div className={`flow-node flow-node--wide gl-output${done ? ' is-on' : ''}`}>
          <span className="flow-node-icon" aria-hidden="true">
            <Hash size={22} strokeWidth={1.8} />
          </span>
          <span className="flow-node-label">{t('flows.gl.out.label')}</span>
          <span className="gl-code">{done ? t(sample.codeKey) : t('flows.gl.analyzing')}</span>
          <span className="gl-confidence">
            <Tag size={12} /> {t('flows.gl.accuracy')} {done ? sample.confidence : '--%'}
          </span>
        </div>
      </div>
    </article>
  )
}

const FLOW_PANELS = [CreditCardDetail, ApInvoiceDetail, GlSuggestionDetail] as const

/* ── Main export: tab selector + expandable detail ── */

export default function FeatureFlows() {
  const { t } = useT()
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const toggle = useCallback((i: number) => {
    setActiveIdx(prev => (prev === i ? null : i))
  }, [])

  return (
    <div className="flow-showcase">
      <div className="flow-tabs" role="tablist">
        {FEATURES.map((f, i) => {
          const isActive = activeIdx === i
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={isActive}
              className={`flow-tab ${f.accent}${isActive ? ' is-active' : ''}`}
              onClick={() => toggle(i)}
            >
              <span className="flow-tab-icon" aria-hidden="true">
                <f.Icon size={20} strokeWidth={1.9} />
              </span>
              <span className="flow-tab-title">{f.title}</span>
              <span className="flow-tab-desc">{t(f.descKey)}</span>
              <ChevronDown size={16} className={`flow-tab-chevron${isActive ? ' is-open' : ''}`} />
            </button>
          )
        })}
      </div>

      <AnimatePresence initial={false}>
        {activeIdx !== null &&
          (() => {
            const Panel = FLOW_PANELS[activeIdx]
            return (
              <motion.div
                key={activeIdx}
                className="flow-detail-inner"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <Panel active />
              </motion.div>
            )
          })()}
      </AnimatePresence>
    </div>
  )
}
